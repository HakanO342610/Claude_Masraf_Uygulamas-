import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/v1';

async function runTest() {
  try {
    console.log('--- E2E TEST START ---');
    
    // 1. Login as Employee
    console.log('1. Logging in as Employee...');
    const employeeLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'employee@company.com',
      password: 'password123'
    });
    const employeeToken = employeeLogin.data.accessToken;
    console.log('Employee logged in successfully.');

    // 2. Create Expense as Employee
    console.log('2. Creating a draft expense...');
    const createRes = await axios.post(`${BASE_URL}/expenses`, {
      expenseDate: new Date().toISOString(),
      amount: 1500,
      currency: 'TRY',
      category: 'Meals',
      description: 'E2E Test Expense'
    }, { headers: { Authorization: `Bearer ${employeeToken}` } });
    const expenseId = createRes.data.id;
    console.log(`Created Expense ID: ${expenseId}`);

    // 3. Submit Expense
    console.log('3. Submitting expense...');
    await axios.patch(`${BASE_URL}/expenses/${expenseId}/submit`, {}, {
      headers: { Authorization: `Bearer ${employeeToken}` }
    });
    console.log('Expense submitted successfully.');

    // 4. Try fetching approvals as Employee (should fail)
    console.log('4. Trying to fetch approvals as Employee (expecting 403)...');
    try {
      await axios.get(`${BASE_URL}/approvals/my`, {
        headers: { Authorization: `Bearer ${employeeToken}` }
      });
      console.error('ERROR: Employee was able to fetch approvals list!');
    } catch (err: any) {
      if (err.response && err.response.status === 403) {
        console.log('SUCCESS: Employee access to approvals denied as expected.');
      } else {
        console.error('Unexpected error when employee fetched approvals:', err.message);
      }
    }

    // 5. Login as Manager
    console.log('5. Logging in as Manager...');
    const managerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'manager@company.com',
      password: 'password123'
    });
    const managerToken = managerLogin.data.accessToken;
    console.log('Manager logged in successfully.');

    // 6. Fetch pending approvals for Manager
    console.log('6. Fetching pending approvals for Manager...');
    // The web UI calls /expenses/pending-approvals which delegates to expensesService.getPendingApprovals()
    // Let's test the endpoint actually used by the web UI (and mobile)
    const pendingRes = await axios.get(`${BASE_URL}/expenses/pending-approvals`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    
    const approvals = pendingRes.data.data || pendingRes.data;
    console.log(`Manager has ${approvals.length} pending approvals.`);
    
    const ourApproval = approvals.find((a: any) => a.expenseId === expenseId || (a.expense && a.expense.id === expenseId) || a.id === expenseId);
    if (!ourApproval) {
       console.error('ERROR: Could not find our submitted expense in manager queue.');
    } else {
       console.log('Found our expense in manager queue. ID to approve:', ourApproval.expense?.id || ourApproval.expenseId);
       
       // 7. Approve the expense
       console.log('7. Approving the expense...');
       const targetId = ourApproval.expense?.id || ourApproval.expenseId || ourApproval.id;
       await axios.patch(`${BASE_URL}/expenses/${targetId}/approve`, {}, {
         headers: { Authorization: `Bearer ${managerToken}` }
       });
       console.log('Expense approved successfully!');
    }

    console.log('--- E2E TEST COMPLETED SUCCESSFULLY ---');
  } catch (err: any) {
    if (err.response) {
      console.error('API Error:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

runTest();
