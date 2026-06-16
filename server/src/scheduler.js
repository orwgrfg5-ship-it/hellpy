const prisma = require('./prisma');

// Polls for due scheduled messages and dispatches them as real messages,
// emitting them live to the relevant room so connected clients see them.
function startScheduler(io) {
  async function tick() {
    const due = await prisma.scheduledMessage.findMany({
      where: { sentAt: null, sendAt: { lte: new Date() } },
      take: 50,
    });
    for (const sm of due) {
      try {
        const message = await prisma.message.create({
          data: {
            authorId: sm.authorId,
            content: sm.content,
            channelId: sm.channelId,
            conversationId: sm.conversationId,
          },
          include: { author: { select: { id: true, username: true, displayName: true } } },
        });
        const room = sm.channelId ? `channel:${sm.channelId}` : `conversation:${sm.conversationId}`;
        io.to(room).emit('message:new', message);
        await prisma.scheduledMessage.update({ where: { id: sm.id }, data: { sentAt: new Date() } });
      } catch (e) {
        // Leave it unsent to retry next tick.
      }
    }
  }
  // Run every 15 seconds.
  setInterval(() => { tick().catch(() => {}); }, 15000);
}

module.exports = { startScheduler };
