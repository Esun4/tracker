import { prisma } from "@/lib/prisma";
import type { Adapter, AdapterAccount, AdapterUser, AdapterSession } from "next-auth/adapters";

export function CustomPrismaAdapter(): Adapter {
  return {
    async createUser(data) {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name ?? null,
          emailVerified: data.emailVerified ?? null,
        },
      });
      return { ...user, emailVerified: user.emailVerified ?? null } as AdapterUser;
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return null;
      return { ...user, emailVerified: user.emailVerified ?? null } as AdapterUser;
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return null;
      return { ...user, emailVerified: user.emailVerified ?? null } as AdapterUser;
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: { provider, providerAccountId },
        },
        include: { user: true },
      });
      if (!account?.user) return null;
      return { ...account.user, emailVerified: account.user.emailVerified ?? null } as AdapterUser;
    },

    async updateUser(data) {
      const user = await prisma.user.update({
        where: { id: data.id },
        data: {
          name: data.name ?? undefined,
          email: data.email ?? undefined,
          emailVerified: data.emailVerified ?? undefined,
        },
      });
      return { ...user, emailVerified: user.emailVerified ?? null } as AdapterUser;
    },

    async deleteUser(userId) {
      await prisma.user.delete({ where: { id: userId } });
    },

    async linkAccount(data) {
      await prisma.account.create({
        data: {
          userId: data.userId,
          type: data.type,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          refresh_token: data.refresh_token ?? null,
          access_token: data.access_token ?? null,
          expires_at: data.expires_at ?? null,
          token_type: data.token_type ?? null,
          scope: data.scope ?? null,
          id_token: data.id_token ?? null,
          session_state: data.session_state as string | null ?? null,
        },
      });
      return data as AdapterAccount;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      await prisma.account.delete({
        where: {
          provider_providerAccountId: { provider, providerAccountId },
        },
      });
    },

    async createSession(data) {
      const session = await prisma.session.create({
        data: {
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: data.expires,
        },
      });
      return session as AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!session) return null;
      return {
        session: session as AdapterSession,
        user: { ...session.user, emailVerified: session.user.emailVerified ?? null } as AdapterUser,
      };
    },

    async updateSession(data) {
      const session = await prisma.session.update({
        where: { sessionToken: data.sessionToken },
        data: {
          expires: data.expires ?? undefined,
        },
      });
      return session as AdapterSession;
    },

    async deleteSession(sessionToken) {
      await prisma.session.delete({ where: { sessionToken } });
    },

    async createVerificationToken(data) {
      const token = await prisma.verificationToken.create({
        data: {
          identifier: data.identifier,
          token: data.token,
          expires: data.expires,
        },
      });
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const vt = await prisma.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
        return vt;
      } catch {
        return null;
      }
    },
  };
}
