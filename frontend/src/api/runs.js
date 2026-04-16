import client from './client';

export const getRunFolderTree = ()       => client.get('/runs/folders').then(r => r.data);
export const createRunFolder  = (body)   => client.post('/runs/folders', body).then(r => r.data);
export const deleteRunFolder  = (id)     => client.delete(`/runs/folders/${id}`);

export const getRunItems   = (run_folder_id, params = {}) => client.get('/runs', { params: { run_folder_id, ...params } }).then(r => r.data);
export const addRunItem    = (body)           => client.post('/runs', body).then(r => r.data);
export const updateRunItem = (id, body)       => client.put(`/runs/${id}`, body).then(r => r.data);
export const deleteRunItem = (id)             => client.delete(`/runs/${id}`);
export const getReport     = (run_folder_id)  => client.get('/runs/report', { params: { run_folder_id } }).then(r => r.data);
