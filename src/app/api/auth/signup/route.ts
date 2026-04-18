import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'

const signupSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(100),
})

export async function POST(request: Request) {
  try {
    const payload = signupSchema.parse(await request.json())
    const email = payload.email.toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use.' }, { status: 409 })
    }
    const passwordHash = await bcrypt.hash(payload.password, 10)
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email,
        passwordHash,
        projects: { create: [{ name: `${payload.name}'s Project` }] },
      },
    })
    // Add the user as owner to their project
    const project = await prisma.project.findFirst({ where: { ownerId: user.id } })
    if (project) {
      await prisma.projectMember.create({
        data: {
          userId: user.id,
          projectId: project.id,
          role: 'owner',
        },
      })
    }
    return NextResponse.json({ id: user.id })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Invalid signup request.' }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
