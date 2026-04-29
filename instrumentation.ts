export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderCron } = await import("@/lib/cron/appointment-reminders");
    startReminderCron();
  }
}
