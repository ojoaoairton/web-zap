import { Flow } from './flow';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  flow: Flow;
}

export interface ProjectsData {
  projects: Project[];
}
