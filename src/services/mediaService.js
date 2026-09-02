import { apiDataEnabled } from '../lib/apiClient';
import { api } from '../lib/apiClient';

export const mediaService = {
  isEnabled: () => apiDataEnabled,

  async upload(bucket, file, _folder) {
    if (!this.isEnabled()) throw new Error('API mode is disabled');
    return api.upload(bucket, file);
  },
};
