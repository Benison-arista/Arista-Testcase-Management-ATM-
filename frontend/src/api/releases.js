import client from './client';

export const getReleaseTree    = ()              => client.get('/releases/tree').then(r => r.data);
export const createRelease     = (body)          => client.post('/releases', body).then(r => r.data);
export const deleteRelease     = (id)            => client.delete(`/releases/${id}`);

export const getFeatures       = (releaseId, params = {}) => client.get(`/releases/${releaseId}/features`, { params }).then(r => r.data);
export const getFeature        = (releaseId, id) => client.get(`/releases/${releaseId}/features/${id}`).then(r => r.data);
export const createFeature     = (releaseId, body) => client.post(`/releases/${releaseId}/features`, body).then(r => r.data);
export const updateFeature     = (releaseId, id, body) => client.put(`/releases/${releaseId}/features/${id}`, body).then(r => r.data);
export const deleteFeature     = (releaseId, id) => client.delete(`/releases/${releaseId}/features/${id}`);

export const getReleaseSummary = (releaseId)     => client.get(`/releases/${releaseId}/summary`).then(r => r.data);
