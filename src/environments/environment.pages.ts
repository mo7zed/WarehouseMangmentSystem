import { environment as productionEnvironment } from './environment.prod';

export const environment = {
  ...productionEnvironment,
  hashRouting: true,
};
