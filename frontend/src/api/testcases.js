import client from './client';

export const listTestcases   = (params) => client.get('/testcases', { params }).then(r => r.data);
export const getTestcase     = (id)     => client.get(`/testcases/${id}`).then(r => r.data);
export const searchTestcases = (params) => client.get('/testcases/search', { params }).then(r => r.data);
export const createTestcase  = (body)   => client.post('/testcases', body).then(r => r.data);
export const updateTestcase  = (id, body) => client.put(`/testcases/${id}`, body).then(r => r.data);
export const deleteTestcase  = (id)     => client.delete(`/testcases/${id}`);
export const importTestcases = (body)   => client.post('/testcases/import', body).then(r => r.data);
export const getHistory      = (id, params) => client.get(`/testcases/${id}/history`, { params }).then(r => r.data);
export const getTestcaseCounts = ()         => client.get('/testcases/counts').then(r => r.data);
