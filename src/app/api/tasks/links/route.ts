import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const links = await prisma.taskLink.findMany({
      where: { userId: session.user.id },
      select: { id: true, fromId: true, toId: true },
    });

    return NextResponse.json(links);
  } catch (error) {
    console.error("Error fetching links:", error);
    return NextResponse.json(
      { error: "Failed to fetch links" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fromId, toId } = await req.json();

    if (!fromId || !toId || fromId === toId) {
      return NextResponse.json(
        { error: "Invalid link" },
        { status: 400 }
      );
    }

    // Verify both tasks belong to the user
    const [fromTask, toTask] = await Promise.all([
      prisma.task.findUnique({ where: { id: fromId } }),
      prisma.task.findUnique({ where: { id: toId } }),
    ]);

    if (!fromTask || !toTask || fromTask.userId !== session.user.id || toTask.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const link = await prisma.taskLink.upsert({
      where: { fromId_toId: { fromId, toId } },
      create: {
        fromId,
        toId,
        userId: session.user.id,
      },
      update: {},
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Error creating link:", error);
    return NextResponse.json(
      { error: "Failed to create link" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fromId, toId } = await req.json();

    if (!fromId || !toId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    // Verify the link belongs to the user
    const link = await prisma.taskLink.findUnique({
      where: { fromId_toId: { fromId, toId } },
    });

    if (!link || link.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 }
      );
    }

    await prisma.taskLink.delete({
      where: { fromId_toId: { fromId, toId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting link:", error);
    return NextResponse.json(
      { error: "Failed to delete link" },
      { status: 500 }
    );
  }
}
