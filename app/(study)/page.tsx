import Calendar from "@/components/Calendar";
import { pageMember } from "@/lib/auth";
import { calendarDates, isDate, todayKST } from "@/lib/dates";
import { listTodos } from "@/lib/store";
import { photoPath } from "@/lib/photos";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const member = await pageMember();
  const query = await searchParams;
  const today = todayKST();
  const month =
    typeof query.month === "string" && isDate(`${query.month}-01`)
      ? query.month
      : today.slice(0, 7);
  const date =
    isDate(query.date) && query.date.startsWith(month)
      ? query.date
      : month === today.slice(0, 7)
        ? today
        : `${month}-01`;
  const days = calendarDates(month);
  const records = await listTodos(days[0], days.at(-1)!);
  const todos = records.map((todo) => ({
    ...todo,
    photo_url: photoPath(todo.photo_key),
  }));
  return (
    <Calendar
      key={month}
      member={member}
      todos={todos}
      month={month}
      selectedDate={date}
      today={today}
    />
  );
}
