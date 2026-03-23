const axios = require('axios');

const BASE_URL = 'https://smart-campas-backend.onrender.com/api';

async function checkUsers() {
  try {
    console.log('Logging in as super admin...');
    const loginRes = await axios.post(BASE_URL + '/auth/login', {
      email: 'alamin-admin@pandait.com',
      password: 'pandaitalaminn'
    });
    const token = loginRes.data.token;
    console.log('Token obtained:', !!token);

    console.log('Getting all users...');
    const usersRes = await axios.get(BASE_URL + '/super-admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Total users:', usersRes.data.data.length);
    usersRes.data.data.forEach(user => {
      console.log(`- ${user.email} (${user.role}) schoolCode: ${user.schoolCode || 'null'}`);
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkUsers();