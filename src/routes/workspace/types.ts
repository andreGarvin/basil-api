export interface Workspace {
  id: string;
  name: string;
  type: string;
  scope: string;
  creator: string;
  section?: string;
  school_id: string;
  archived: boolean;
  created_at: string;
  description: string;
}

export interface NewWorkspaceInfo {
  name: string;
  type?: string;
  scope?: string;
  section?: string;
  description?: string;
}

export interface AggregatedWorkspaceInfo {
  id: string;
  name: string;
  type: string;
  scope: string;
  meta?: MetaField;
  creator: string;
  section: string;
  archived: boolean;
  created_at: string;
  description: string;
}

interface MetaField {
  status: string;
  joined_at: string;
  is_active: boolean;
  is_creator: boolean;
  is_member?: boolean;
  last_active_at: string;
}

export interface UpdatedWorkspaceInfo {
  name: string;
  type: string;
  scope: string;
  section: string;
  description: string;
}

export interface UpdateWorkspaceInfoParameters {
  name?: string;
  type?: string;
  scope?: string;
  section?: string;
  description?: string;
}
