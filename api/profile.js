import { supabaseAdmin, getAuthenticatedUser, json } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (!supabaseAdmin) return json(res, 500, { error: 'Supabase admin not configured' });

  const user = await getAuthenticatedUser(req);
  if (!user) return json(res, 401, { error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,email,display_name,avatar_url,created_at,user_type,organization_name,organization_size,organization_industry,onboarding_complete')
      .eq('id', user.id)
      .single();

    if (error || !data) return json(res, 404, { error: 'Profile not found' });

    return json(res, 200, {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
      userType: data.user_type || 'individual',
      organizationName: data.organization_name,
      organizationSize: data.organization_size,
      organizationIndustry: data.organization_industry,
      onboardingComplete: !!data.onboarding_complete,
    });
  }

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const updates = {};
    if (body.displayName !== undefined) updates.display_name = body.displayName;
    if (body.avatarUrl !== undefined) updates.avatar_url = body.avatarUrl;
    if (body.userType !== undefined) updates.user_type = body.userType;
    if (body.organizationName !== undefined) updates.organization_name = body.organizationName;
    if (body.organizationSize !== undefined) updates.organization_size = body.organizationSize;
    if (body.organizationIndustry !== undefined) updates.organization_industry = body.organizationIndustry;
    if (body.onboardingComplete !== undefined) updates.onboarding_complete = body.onboardingComplete;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id,email,display_name,avatar_url,created_at,user_type,organization_name,organization_size,organization_industry,onboarding_complete')
      .single();

    if (error || !data) return json(res, 400, { error: error?.message || 'Update failed' });

    return json(res, 200, {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
      userType: data.user_type || 'individual',
      organizationName: data.organization_name,
      organizationSize: data.organization_size,
      organizationIndustry: data.organization_industry,
      onboardingComplete: !!data.onboarding_complete,
    });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
