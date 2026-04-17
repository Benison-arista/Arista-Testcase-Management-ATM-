import client from './client';

// Legacy run folders
export const getRunFolderTree = ()       => client.get('/runs/folders').then(r => r.data);
export const createRunFolder  = (body)   => client.post('/runs/folders', body).then(r => r.data);
export const deleteRunFolder  = (id)     => client.delete(`/runs/folders/${id}`);

// Run items (shared)
export const getRunItems   = (run_folder_id, params = {}) => client.get('/runs', { params: { run_folder_id, ...params } }).then(r => r.data);
export const addRunItem    = (body)           => client.post('/runs', body).then(r => r.data);
export const updateRunItem = (id, body)       => client.put(`/runs/${id}`, body).then(r => r.data);
export const deleteRunItem = (id)             => client.delete(`/runs/${id}`);
export const getReport     = (run_folder_id)  => client.get('/runs/report', { params: { run_folder_id } }).then(r => r.data);

// Release-based runs
export const getReleasesTree  = ()           => client.get('/runs/releases-tree').then(r => r.data);
export const getRunsByRelease = (params)     => client.get('/runs/by-release', { params }).then(r => r.data);
export const addRunToRelease  = (body)       => client.post('/runs/by-release', body).then(r => r.data);
export const getTCsByFolder   = (params)     => client.get('/runs/tcs-by-folder', { params }).then(r => r.data);
export const getReleaseRunSummary = (params) => client.get('/runs/release-summary', { params }).then(r => r.data);
export const getTestRunsByRelease = (releaseId) => client.get('/runs/test-runs', { params: { release_id: releaseId } }).then(r => r.data);
export const createTestRun = (body) => client.post('/runs/test-runs', body).then(r => r.data);
