import { Polar } from '@polar-sh/sdk';

const accessToken = process.env.POLAR_ACCESS_TOKEN;

if (!accessToken) {
    console.warn('POLAR_ACCESS_TOKEN is not defined');
}

export const polar = new Polar({
    accessToken: accessToken || '',
    server: 'production', // Use production as user provided live credentials
});

export const ORGANIZATION_ID = process.env.POLAR_ORGANIZATION_ID;
