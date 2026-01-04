import { z } from 'zod';

export const CreateDraftRequestSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.unknown())
});

export const UpdateUserRequestSchema = z.object({
  displayName: z.string().min(1).optional()
});
