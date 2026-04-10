export type Workspace = {
  id: number;
  workspace_name: string;
};

export type Note = {
  id: string;
  title: string;
  parent_id: string | null;
  is_folder: boolean;
  folder_open: boolean;
  updated_at: Date;
  deleted: boolean;
};

export type NoteContent = {
  id: string;
  title: string;
  parent_id: string | null;
  is_folder: boolean;
  folder_open: boolean;
  content: string;
  updated_at: Date;
  deleted: boolean;
};
