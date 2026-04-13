import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const positions = await req.json();

    // Update positions for all provided tasks
    for (const [taskId, position] of Object.entries(positions)) {
      const pos = position as { x: number; y: number };
      
      // Verify task ownership
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task || task.userId !== session.user.id) {
        continue; // Skip if not owned by user
      }

      await prisma.task.update({
        where: { id: taskId },
        data: {
          x: pos.x,
          y: pos.y,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving positions:", error);
    return NextResponse.json(
      { error: "Failed to save positions" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      where: { userId: session.user.id },
      select: { id: true, x: true, y: true },
    });

    const positions: Record<string, { x: number; y: number }> = {};
    tasks.forEach((task) => {
      positions[task.id] = {
        x: task.x || 0,
        y: task.y || 0,
      };
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error("Error fetching positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
