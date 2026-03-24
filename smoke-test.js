const axios = require('axios');
const BASE_URL = 'https://smart-campas-backend.onrender.com/api';

async function run() {
    try {
        console.log('1) Auth principal');
        const auth = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'sultana@vis.edu',
            password: 'Sultana@123'
        });
        const token = auth.data?.data?.token || auth.data?.token;
        console.log('principal token?', !!token);

        const headers = { Authorization: `Bearer ${token}` };

        console.log('2) Principal classes');

        const classes = await axios.get(`${BASE_URL}/principal/classes`, { headers });
        console.log('Principal classes status', classes.status, 'count', classes.data?.data?.length);

        const routineDaily = await axios.get(`${BASE_URL}/routine/daily?studentClass=1&section=A`, { headers });
        console.log('routine daily status', routineDaily.status, routineDaily.data);

        const attReport = await axios.get(`${BASE_URL}/attendance/report?studentClass=1&section=A`, { headers });
        console.log('attendance report status', attReport.status, attReport.data);

    } catch (err) {
        console.error('error', err.response?.status, err.response?.data || err.message);
    }
}

run();