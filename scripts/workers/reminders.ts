import { runWorker } from "./lib";
import { prisma } from "../../src/lib/db/prisma";
import { appUrl, emailEnabled, getEmailProvider, sendEmail } from "../../src/domains/email/email-service";
import { careReminderEmail } from "../../src/domains/email/templates";

const reminderLookbackMs = 24 * 60 * 60 * 1000;

async function sendDueCareReminders() {
  const provider = getEmailProvider();
  if (!emailEnabled() && provider.name !== "console") {
    console.log("[reminders] email delivery disabled; skipping care reminder send.");
    return;
  }

  const now = new Date();
  const tasks = await prisma.careTask.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: now }
    },
    include: {
      aquarium: true,
      careSchedule: { include: { collection: { include: { owner: true } } } }
    },
    orderBy: { dueAt: "asc" },
    take: 25
  });

  for (const task of tasks) {
    const since = new Date(Date.now() - reminderLookbackMs);
    const alreadySent = await prisma.emailLog.findFirst({
      where: {
        template: "care-reminder",
        entityType: "CareTask",
        entityId: task.id,
        createdAt: { gte: since },
        status: { in: ["QUEUED", "SENT"] }
      }
    });
    if (alreadySent) continue;

    const owner = task.careSchedule.collection.owner;
    await sendEmail({
      ...careReminderEmail({
        title: task.title,
        aquariumName: task.aquarium?.name,
        dueText: task.dueAt.toLocaleString(),
        actionUrl: appUrl(task.aquariumId ? `/aquariums/${task.aquariumId}#maintenance` : "/dashboard"),
        description: task.description
      }),
      to: owner.email,
      collectionId: task.careSchedule.collectionId,
      userId: owner.id,
      template: "care-reminder",
      entityType: "CareTask",
      entityId: task.id
    });
  }

  console.log(`[reminders] scanned ${tasks.length} due care task(s).`);
}

runWorker({
  name: "reminders",
  enabledEnv: "ENABLE_REMINDERS_WORKER",
  tick: sendDueCareReminders
});
