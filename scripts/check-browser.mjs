import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Optional real-browser checks; uses installed Chrome and the isolated HTTP fixture.
export async function checkBrowser({ base, token, requests, todos, state }) {
  const profile = await mkdtemp(join(tmpdir(), "nodit-chrome-"));
  const artifacts = join(tmpdir(), "nodit-qa");
  await mkdir(artifacts, { recursive: true });
  const chrome = spawn(
    process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let socket;
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      try {
        port = Number(
          (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(
            "\n",
          )[0],
        );
        break;
      } catch {}
      await delay(100);
    }
    assert.ok(port, "headless Chrome starts");
    const targets = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    socket = new WebSocket(
      targets.find((target) => target.type === "page").webSocketDebuggerUrl,
    );
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const pending = new Map();
    const browserRequests = [];
    const exceptions = [];
    let id = 0;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const promise = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) promise.reject(new Error(message.error.message));
        else promise.resolve(message.result);
      } else if (
        message.method === "Network.requestWillBeSent" &&
        message.params.request.url.startsWith(base)
      )
        browserRequests.push(message.params.request);
      else if (message.method === "Runtime.exceptionThrown")
        exceptions.push(message.params.exceptionDetails.text);
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const current = ++id;
        pending.set(current, { resolve, reject });
        socket.send(JSON.stringify({ id: current, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text,
        );
      return result.result.value;
    };
    const waitFor = async (expression) => {
      for (let i = 0; i < 120; i++) {
        if (await evaluate(expression)) return;
        await delay(50);
      }
      throw new Error(`Browser condition timed out: ${expression}`);
    };
    const screenshot = async (name) => {
      const metrics = await send("Page.getLayoutMetrics");
      const { data } = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: metrics.cssLayoutViewport.clientWidth,
          height: Math.min(metrics.cssContentSize.height, 2800),
          scale: 1,
        },
      });
      await writeFile(join(artifacts, name), Buffer.from(data, "base64"));
    };
    await send("Page.enable");
    await send("Network.enable");
    await send("Runtime.enable");
    await send("Network.setCookie", {
      name: "ccarf_session",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    });
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", {
      url: `${base}/?month=2026-11&date=2026-11-05`,
    });
    await waitFor(`document.querySelectorAll('.calendar-entry').length === 8`);
    await delay(1000);
    assert.equal(
      await evaluate(
        `document.querySelectorAll('[aria-label^="2026-11-05"] .calendar-entry').length`,
      ),
      7,
    );
    await screenshot("calendar-desktop.png");
    requests.length = 0;
    browserRequests.length = 0;
    await evaluate(
      `document.querySelector('[aria-label^="2026-11-06"]').click()`,
    );
    await waitFor(
      `location.search.includes('date=2026-11-06') && document.querySelector('[aria-label^="2026-11-06"]').getAttribute('aria-pressed') === 'true'`,
    );
    await evaluate(`history.back()`);
    await waitFor(
      `location.search.includes('date=2026-11-05') && document.querySelector('[aria-label^="2026-11-05"]').getAttribute('aria-pressed') === 'true'`,
    );
    await delay(150);
    assert.equal(
      requests.length,
      0,
      "same-month date selection and back make zero database requests",
    );
    assert.equal(
      browserRequests.length,
      0,
      "same-month date selection and back make zero HTTP requests",
    );
    await evaluate(
      `document.querySelectorAll('.filter-buttons button')[1].click()`,
    );
    await waitFor(`document.querySelectorAll('.calendar-entry').length === 3`);
    await evaluate(`document.querySelector('.filter-buttons button').click()`);
    await waitFor(`document.querySelectorAll('.calendar-entry').length === 8`);
    const completion = `document.querySelector('.todo-check:not(:disabled)')`;
    await evaluate(`${completion}.click()`);
    await waitFor(
      `${completion.replace(":not(:disabled)", "")}.getAttribute('aria-pressed') === 'false'`,
    );
    await waitFor(`!document.querySelector('.todo-check').disabled`);
    assert.equal(
      todos[0].completed_at,
      null,
      "completion saves and revalidates",
    );
    state.failNextTodoWrite = true;
    await evaluate(`${completion}.click()`);
    await waitFor(
      `document.querySelector('.todo-check').getAttribute('aria-pressed') === 'true'`,
    );
    await waitFor(
      `!document.querySelector('.todo-check').disabled && !!document.querySelector('.floating-error')`,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('.todo-check').getAttribute('aria-pressed')`,
      ),
      "false",
      "failed optimistic change rolls back",
    );
    await evaluate(`document.querySelector('.floating-error button').click()`);
    browserRequests.length = 0;
    await evaluate(`document.querySelector('.page-heading .primary').click()`);
    await waitFor(`!!document.querySelector('dialog[open] input#todo-title')`);
    await evaluate(
      `(() => { const input=document.querySelector('#todo-title'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'검증용 새 일정'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await evaluate(
      `document.querySelector('.dialog-actions-end .primary').click()`,
    );
    await waitFor(
      `!document.querySelector('dialog[open]') && document.querySelectorAll('.calendar-entry').length === 9`,
    );
    assert.equal(
      todos.length,
      9,
      "create action updates calendar without extra client refresh",
    );
    assert.equal(
      browserRequests.filter(
        (request) =>
          request.method === "GET" && new URL(request.url).pathname === "/",
      ).length,
      0,
      "calendar save has no redundant GET refresh",
    );
    await evaluate(
      `document.querySelector('.desktop-nav a[href="/shared"]').click()`,
    );
    await waitFor(`!!document.querySelector('.board-toolbar')`);
    await delay(200);
    await evaluate(`document.querySelector('.page-heading .primary').click()`);
    await waitFor(`!!document.querySelector('dialog[open] #post-body')`);
    await evaluate(
      `(() => { const input=document.querySelector('#post-body'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'공유 검증 메모'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await evaluate(
      `document.querySelector('dialog[open] .dialog-actions .primary').click()`,
    );
    await waitFor(
      `!document.querySelector('dialog[open]') && document.querySelector('.post-body')?.textContent === '공유 검증 메모'`,
    );
    await evaluate(
      `document.querySelector('.desktop-nav a[href="/"]').click()`,
    );
    await waitFor(`document.querySelectorAll('.calendar-entry').length === 9`);
    for (const width of [390, 360]) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await delay(100);
      assert.ok(
        await evaluate(`document.documentElement.scrollWidth <= innerWidth`),
        `no horizontal overflow at ${width}px`,
      );
      await waitFor(
        `[...document.querySelectorAll('.calendar-entry')].every(el=>getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0)`,
      );
      await screenshot(`calendar-mobile-${width}.png`);
    }
    await send("Page.navigate", { url: `${base}/quiz` });
    await waitFor(
      `document.querySelectorAll('input[type="checkbox"]').length === 4`,
    );
    await delay(300);
    await screenshot("quiz-mobile.png");
    await evaluate(
      `document.querySelectorAll('input[type="checkbox"]')[0].click(); document.querySelectorAll('input[type="checkbox"]')[1].click()`,
    );
    await evaluate(
      `[...document.querySelectorAll('button')].find(button=>button.textContent.includes('103문항 시작하기')).click()`,
    );
    await waitFor(
      `document.querySelectorAll('button[aria-pressed]').length === 4`,
    );
    await screenshot("quiz-question-mobile.png");
    await send("Network.deleteCookies", { name: "ccarf_session", url: base });
    await send("Page.navigate", { url: `${base}/login` });
    await waitFor(`!!document.querySelector('.login-card')`);
    await screenshot("login-mobile.png");
    assert.deepEqual(exceptions, [], "no uncaught browser errors");
    console.log(
      `PASS Chrome: date/back zero requests, member filter, completion rollback, calendar/post create and revalidate, mobile 360/390px, quiz, login. Screenshots: ${artifacts}`,
    );
  } finally {
    socket?.close();
    chrome.kill("SIGTERM");
    await new Promise((resolve) =>
      chrome.exitCode !== null ? resolve() : chrome.once("exit", resolve),
    );
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}
