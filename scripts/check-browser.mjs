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
    const choosePostImage = (label) =>
      evaluate(`(() => {
      const canvas=document.createElement('canvas'); canvas.width=480; canvas.height=300;
      const ctx=canvas.getContext('2d'); ctx.fillStyle='#fbf2d8'; ctx.fillRect(0,0,480,300);
      ctx.fillStyle='#342c1c'; ctx.font='bold 40px sans-serif'; ctx.fillText('CCAR-F',40,90);
      ctx.font='24px sans-serif'; ctx.fillText(${JSON.stringify(label)},40,150);
      const bytes=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));
      const transfer=new DataTransfer(); transfer.items.add(new File([bytes],'study.png',{type:'image/png'}));
      const input=document.querySelector('#post-photo'); input.files=transfer.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await choosePostImage("study note");
    await waitFor(
      `document.querySelector('.post-image-editor img')?.naturalWidth === 480`,
    );
    state.failNextPostWrite = true;
    await evaluate(
      `document.querySelector('dialog[open] .dialog-actions .primary').click()`,
    );
    await waitFor(`!!document.querySelector('dialog[open] [role="alert"]')`);
    assert.equal(
      await evaluate(`document.querySelector('#post-body').value`),
      "공유 검증 메모",
      "failed post keeps the body",
    );
    assert.ok(
      await evaluate(
        `document.querySelector('.post-image-editor img').src.startsWith('blob:')`,
      ),
      "failed post keeps the selected image",
    );
    await evaluate(
      `document.querySelector('dialog[open] .dialog-actions .primary').click()`,
    );
    await waitFor(
      `!document.querySelector('dialog[open]') && document.querySelector('.post-body')?.textContent === '공유 검증 메모'`,
    );
    await waitFor(`document.querySelectorAll('.comment-body').length === 2`);
    await waitFor(
      `document.querySelector('.post-image img')?.naturalWidth === 480`,
    );
    const firstPostPhoto = await evaluate(
      `document.querySelector('.post-image').getAttribute('href')`,
    );
    const commentBodies = () =>
      evaluate(
        `[...document.querySelectorAll('.comment-body')].map(el=>el.textContent)`,
      );
    const typeComment = (selector, body) =>
      evaluate(`(() => {
      const input=document.querySelector(${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,${JSON.stringify(body)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    assert.deepEqual(await commentBodies(), ["먼저 쓴 댓글", "나중 쓴 댓글"]);
    assert.equal(
      await evaluate(
        `!!document.querySelector('.comment-item').querySelector('.comment-actions')`,
      ),
      false,
      "post owner cannot edit another member's comment",
    );
    assert.equal(
      await evaluate(`!!document.querySelector('.comment-form')`),
      false,
      "new comment input is initially collapsed while comments remain visible",
    );
    const commentTypography = await evaluate(`(() => {
      const postName=document.querySelector('.post-top strong');
      const postDate=document.querySelector('.post-top time');
      const name=document.querySelector('.comment-author strong');
      const date=document.querySelector('.comment-author time');
      return {postName:parseFloat(getComputedStyle(postName).fontSize), postDate:parseFloat(getComputedStyle(postDate).fontSize), name:parseFloat(getComputedStyle(name).fontSize), date:parseFloat(getComputedStyle(date).fontSize), nameColor:getComputedStyle(name).color, dateColor:getComputedStyle(date).color, right:date.getBoundingClientRect().left >= name.getBoundingClientRect().right, sameLine:Math.abs(date.getBoundingClientRect().top-name.getBoundingClientRect().top)<5};
    })()`);
    assert.ok(commentTypography.postName > commentTypography.name);
    assert.ok(commentTypography.postDate > commentTypography.date);
    assert.notEqual(commentTypography.nameColor, commentTypography.dateColor);
    assert.ok(
      commentTypography.right && commentTypography.sameLine,
      "comment time is beside the name",
    );
    await evaluate(`document.querySelector('.comment-compose-toggle').click()`);
    await waitFor(
      `document.querySelector('.comment-compose-toggle')?.getAttribute('aria-expanded') === 'true' && document.activeElement === document.querySelector('.comment-form textarea')`,
    );
    await typeComment(".comment-form textarea", "작성 중 댓글");
    await evaluate(`document.querySelector('.comment-compose-toggle').click()`);
    await waitFor(`!document.querySelector('.comment-form')`);
    assert.equal(
      await evaluate(`document.querySelectorAll('.comment-body').length`),
      2,
      "closing the input keeps the comment list visible",
    );
    await evaluate(`document.querySelector('.comment-compose-toggle').click()`);
    await waitFor(`!!document.querySelector('.comment-form textarea')`);
    assert.equal(
      await evaluate(`document.querySelector('.comment-form textarea').value`),
      "작성 중 댓글",
      "closing and reopening preserves the draft",
    );
    await typeComment(".comment-form textarea", "등록한 댓글");
    await evaluate(`document.querySelector('.comment-form .button').click()`);
    await waitFor(`document.querySelectorAll('.comment-body').length === 3`);
    await waitFor(
      `!document.querySelector('.comment-form') && document.activeElement === document.querySelector('.comment-compose-toggle')`,
    );
    assert.deepEqual(await commentBodies(), [
      "먼저 쓴 댓글",
      "나중 쓴 댓글",
      "등록한 댓글",
    ]);
    const created = await evaluate(
      `document.querySelectorAll('.comment-item time')[1].dateTime`,
    );
    await evaluate(
      `document.querySelectorAll('.comment-item')[1].querySelector('.comment-actions button').click()`,
    );
    await waitFor(`!!document.querySelector('.comment-edit-form textarea')`);
    await typeComment(".comment-edit-form textarea", "수정한 댓글");
    await evaluate(
      `document.querySelector('.comment-edit-form .primary').click()`,
    );
    await waitFor(
      `!document.querySelector('.comment-edit-form') && document.querySelectorAll('.comment-body')[1]?.textContent === '수정한 댓글'`,
    );
    assert.deepEqual(await commentBodies(), [
      "먼저 쓴 댓글",
      "수정한 댓글",
      "등록한 댓글",
    ]);
    assert.equal(
      await evaluate(
        `document.querySelectorAll('.comment-item time')[1].dateTime`,
      ),
      created,
    );
    state.failNextCommentWrite = true;
    await evaluate(`document.querySelector('.comment-compose-toggle').click()`);
    await waitFor(`!!document.querySelector('.comment-form textarea')`);
    await typeComment(".comment-form textarea", "다시 등록할 댓글");
    await evaluate(`document.querySelector('.comment-form .button').click()`);
    await waitFor(`!!document.querySelector('.post-comments [role="alert"]')`);
    assert.equal(
      await evaluate(`document.querySelector('.comment-form textarea').value`),
      "다시 등록할 댓글",
      "failed comment preserves the draft",
    );
    await evaluate(`document.querySelector('.comment-form .button').click()`);
    await waitFor(`document.querySelectorAll('.comment-body').length === 4`);
    await evaluate(`(() => {
      const item=[...document.querySelectorAll('.comment-item')].find(el=>el.querySelector('.comment-body')?.textContent==='등록한 댓글');
      [...item.querySelectorAll('.comment-actions button')].find(el=>el.textContent==='삭제').click();
    })()`);
    await waitFor(`!!document.querySelector('dialog[open] .danger-button')`);
    await evaluate(
      `document.querySelector('dialog[open] .danger-button').click()`,
    );
    await waitFor(
      `!document.querySelector('dialog[open]') && document.querySelectorAll('.comment-body').length === 3`,
    );
    assert.deepEqual(await commentBodies(), [
      "먼저 쓴 댓글",
      "수정한 댓글",
      "다시 등록할 댓글",
    ]);
    await screenshot("comments-desktop.png");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(100);
    assert.ok(
      await evaluate(`document.documentElement.scrollWidth <= innerWidth`),
      "comments fit a 360px mobile screen",
    );
    assert.ok(
      await evaluate(`(() => {
      const name=document.querySelector('.comment-author strong').getBoundingClientRect();
      const date=document.querySelector('.comment-author time').getBoundingClientRect();
      return date.left >= name.right && Math.abs(date.top-name.top) < 5;
    })()`),
      "comment name and time share a line at 360px",
    );
    await screenshot("comments-mobile.png");
    await evaluate(`document.querySelector('.comment-compose-toggle').click()`);
    await waitFor(
      `document.activeElement === document.querySelector('.comment-form textarea')`,
    );
    assert.ok(
      await evaluate(`document.documentElement.scrollWidth <= innerWidth`),
      "comment input fits a 360px mobile screen",
    );
    await screenshot("comment-input-mobile.png");
    await evaluate(`document.querySelector('.comment-compose-toggle').click()`);
    await evaluate(
      `document.querySelector('.post-actions [aria-label$="글 수정"]').click()`,
    );
    await waitFor(`!!document.querySelector('dialog[open] #post-photo')`);
    await waitFor(
      `document.querySelector('.post-image-editor img')?.naturalWidth === 480`,
    );
    assert.ok(
      await evaluate(
        `document.querySelector('dialog[open]').scrollWidth <= document.querySelector('dialog[open]').clientWidth`,
      ),
      "post image editor fits 360px",
    );
    await screenshot("post-image-editor-mobile.png");
    await evaluate(
      `document.querySelector('.post-image-editor button').click()`,
    );
    await evaluate(
      `document.querySelector('dialog[open] [aria-label="닫기"]').click()`,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('.post-image').getAttribute('href')`,
      ),
      firstPostPhoto,
      "cancel leaves image unchanged",
    );
    await evaluate(
      `document.querySelector('.post-actions [aria-label$="글 수정"]').click()`,
    );
    await waitFor(`!!document.querySelector('dialog[open] #post-photo')`);
    await choosePostImage("replacement");
    await evaluate(
      `document.querySelector('dialog[open] .dialog-actions .primary').click()`,
    );
    await waitFor(
      `!document.querySelector('dialog[open]') && document.querySelector('.post-image')?.getAttribute('href') !== ${JSON.stringify(firstPostPhoto)}`,
    );
    await waitFor(
      `document.querySelector('.post-image img')?.naturalWidth === 480`,
    );
    const secondPostPhoto = await evaluate(
      `document.querySelector('.post-image').getAttribute('href')`,
    );
    assert.notEqual(firstPostPhoto, secondPostPhoto);
    await evaluate(
      `document.querySelector('.post-actions [aria-label$="글 수정"]').click()`,
    );
    await waitFor(`!!document.querySelector('dialog[open] #post-photo')`);
    await evaluate(
      `document.querySelector('.post-image-editor button').click()`,
    );
    await evaluate(
      `document.querySelector('dialog[open] .dialog-actions .primary').click()`,
    );
    await waitFor(
      `!document.querySelector('dialog[open]') && !document.querySelector('.post-image')`,
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
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
      `PASS Chrome: calendar navigation and saves, post image upload/preview/replace/remove/cancel/failure recovery, comment typography/toggle/focus/draft preservation/create/edit/delete/order/ownership/failure recovery, mobile 360/390px, quiz, login. Screenshots: ${artifacts}`,
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
