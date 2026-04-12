import { supabase } from './supabase';
import { Project } from '@/types/project';
import { createDefaultFlow } from '@/context/FlowContext';

/**
 * Busca todos os projetos de um usuário logado
 */
export async function getProjects(userId?: string) {
  let query = supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });
    
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
  return data;
}

/**
 * Salva ou atualiza um projeto no banco
 */
export async function saveProject(project: any) {
  const { data, error } = await supabase
    .from('projects')
    .upsert({
      id: project.id,
      user_id: project.user_id,
      name: project.name,
      slug: project.slug,
      flow: project.flow,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving project:', error);
    throw error;
  }
  return data;
}

/**
 * Exclui um projeto pelo ID
 */
export async function deleteProject(id: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
  return true;
}

/**
 * Busca um projeto especificamente pelo Slug para uso no player público (Sem necessidade de auth dependendo do RLS Policy)
 */
export async function getProjectBySlug(slug: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
        console.error('Error fetching project by slug:', error);
    }
    return null;
  }
  return data;
}

/**
 * Cria um novo projeto vazio com flow padrão
 */
export async function createProject(name: string): Promise<string> {
  const flowId = crypto.randomUUID();
  const flow = createDefaultFlow();
  flow.id = flowId;
  flow.name = name;
  
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || flowId;

  await saveProject({
    id: flowId,
    name: name,
    slug: slug,
    flow: flow
  });

  return flowId;
}

/**
 * Duplica um projeto por ID (recria um registro idêntico com outro ID e nome ajustado)
 */
export async function duplicateProject(projectId: string): Promise<string | null> {
  const { data: projectToCopy, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !projectToCopy) return null;

  const newId = crypto.randomUUID();
  const newFlow = JSON.parse(JSON.stringify(projectToCopy.flow)); // deep copy
  newFlow.id = newId;
  const newName = `Cópia de ${projectToCopy.name}`;
  newFlow.name = newName;

  const slug = newName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || newId;

  await saveProject({
    id: newId,
    name: newName,
    slug: slug + '-' + newId.substring(0, 4),
    flow: newFlow,
    user_id: projectToCopy.user_id
  });

  return newId;
}
