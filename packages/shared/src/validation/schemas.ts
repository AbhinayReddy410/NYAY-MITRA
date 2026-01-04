import { z } from 'zod/v3';

export const CreateDraftRequestSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.unknown())
});

export const UpdateUserRequestSchema = z.object({
  displayName: z.string().min(1).optional()
});
