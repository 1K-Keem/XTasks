const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const tasks = await prisma.task.findMany({ select: { id: true, subtasksJson: true, commentsJson: true } })
  console.log(JSON.stringify(tasks, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
