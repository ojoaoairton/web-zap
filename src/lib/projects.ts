import { Project, ProjectsData } from '@/types/project';
import { createDefaultFlow, STORAGE_KEY as LEGACY_STORAGE_KEY } from '@/context/FlowContext';

export const PROJECTS_KEY = 'zaperflux_projects';

export function getProjects(): Project[] {
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (data) {
      const parsed = JSON.parse(data) as ProjectsData;
      return parsed.projects || [];
    }
  } catch (e) {
    console.error('Failed to parse projects', e);
  }

  // Migration logic from old single project
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsedFlow = JSON.parse(legacy);
      // Migrate it into projects array
      const newProject: Project = {
        id: parsedFlow.id || crypto.randomUUID(),
        name: parsedFlow.name || 'Meu Fluxo Migrate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        flow: parsedFlow
      };
      
      const newProjects = [newProject];
      localStorage.setItem(PROJECTS_KEY, JSON.stringify({ projects: newProjects } as ProjectsData));
      
      return newProjects;
    }
  } catch (e) {
    console.error('Failed to migrate legacy flow', e);
  }

  return [];
}

function saveProjectsArray(projects: Project[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify({ projects } as ProjectsData));
  } catch (e) {
    console.error('Failed to save projects', e);
  }
}

export function createProject(name: string): string {
  const projects = getProjects();
  const flowId = crypto.randomUUID();
  const flow = createDefaultFlow();
  flow.id = flowId;
  flow.name = name;

  const newProject: Project = {
    id: flowId,
    name: name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flow: flow
  };

  projects.push(newProject);
  saveProjectsArray(projects);

  return flowId;
}

export function saveProject(projectId: string, updatedFlow: any) {
  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  
  if (idx > -1) {
    projects[idx].flow = updatedFlow;
    projects[idx].name = updatedFlow.name || projects[idx].name;
    projects[idx].updatedAt = new Date().toISOString();
  } else {
    // If not found, create it (edge case)
    projects.push({
      id: projectId,
      name: updatedFlow.name || 'Projeto sem nome',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      flow: updatedFlow
    });
  }

  saveProjectsArray(projects);
}

export function duplicateProject(projectId: string): string | null {
  const projects = getProjects();
  const projectToCopy = projects.find(p => p.id === projectId);
  if (!projectToCopy) return null;

  const newId = crypto.randomUUID();
  const newFlow = JSON.parse(JSON.stringify(projectToCopy.flow)); // deep copy
  newFlow.id = newId;
  newFlow.name = `Cópia de ${projectToCopy.flow.name || projectToCopy.name}`;

  const duplicatedProject: Project = {
    id: newId,
    name: newFlow.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flow: newFlow
  };

  projects.push(duplicatedProject);
  saveProjectsArray(projects);

  return newId;
}

export function deleteProject(projectId: string): void {
  let projects = getProjects();
  projects = projects.filter(p => p.id !== projectId);
  saveProjectsArray(projects);
}
