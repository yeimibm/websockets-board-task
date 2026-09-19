export interface Project {
  id: string;
  name: string;
  roomId: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
  participants: string[];
}
