export interface Draft {
  id: string;
  userId: string;
  templateId: string;
  templateName: string;
  categoryName: string;
  generatedFileURL: string;
  variables: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}
