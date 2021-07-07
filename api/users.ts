import prisma from "./prisma";

export function groups(userId: number) {
  return prisma.group.findMany({
    where: {
      users: {
        some: {
          id: userId,
        },
      },
    },
  });
}

export function allEvents(userId: number) {
  return prisma.event.findMany({
    // where some of the group's users have the id `userId`
    where: {
      AND: [
        {
          group: {
            users: {
              some: {
                id: userId,
              },
            },
          },
        },
        {
          OR: [
            {
              endTime: {
                equals: null,
              },
            },
            {
              endTime: {
                lt: new Date(),
              },
            },
          ],
        },
      ],
    },
  });
}

export function activeEvents(userId: number) {
  return prisma.event.findMany({
    // where some of the group's users have the id `userId`
    where: {
      group: {
        users: {
          some: {
            id: userId,
          },
        },
      },
    },
  });
}

export async function requests(id: number) {
  const requests = await prisma.invitation.findMany({
      select: {
          userId: true,
          carpoolId: true,
          sentTime: true
      },
      where: {
          userId: id,
          isRequest: true
      }
  });
  
  return requests;
}

export async function invitations(id: number) {
  const invitations = await prisma.invitation.findMany({
      select: {
          userId: true,
          carpoolId: true,
          sentTime: true
      },
      where: {
          userId: id,
          isRequest: false
      }
  });
  
  return invitations;
}