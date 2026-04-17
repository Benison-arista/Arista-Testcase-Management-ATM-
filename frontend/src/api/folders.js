import client from './client';

export const getFolderTree = (section) => client.get('/folders', { params: { section } }).then(r => r.data);
export const createFolder  = (body)    => client.post('/folders', body).then(r => r.data);
export const moveFolder    = (id, body) => client.patch(`/folders/${id}/move`, body).then(r => r.data);
export const renameFolder  = (id, body) => client.patch(`/folders/${id}/rename`, body).then(r => r.data);
export const deleteFolder  = (id)      => client.delete(`/folders/${id}`);
