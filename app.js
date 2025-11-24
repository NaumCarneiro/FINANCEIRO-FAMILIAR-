// app.js

/**
 * ========================================
 * 1. VARIÁVEIS E ESTADO GLOBAL
 * ========================================
 */
const STORAGE_KEY = 'financeFamStateV2';

// Estrutura do estado global inicial
const initialAppState = {
    users: [
        { id: 'admin', username: 'admin', password: '12345', role: 'admin', lastLogin: null },
        { id: 'user1', username: 'joao', password: '12345', role: 'standard', lastLogin: null },
    ],
    currentUser: null, 
    currentDate: new Date(2025, 10, 23),
    transactions: [
        { id: Date.now() + 1, type: 'income', amount: 3000.00, category: 'Salário', description: 'Renda Mensal', date: '2025-11-05', timestamp: Date.parse('2025-11-05T09:00:00'), userId: 'admin' },
        { id: Date.now() + 2, type: 'expense', amount: 150.00, category: 'Alimentação', description: 'Restaurante', date: '2025-11-10', timestamp: Date.parse('2025-11-10T19:00:00'), userId: 'user1' },
    ],
};

let appState = loadState();

/**
 * ========================================
 * 2. PERSISTÊNCIA E UTILITÁRIOS
 * ========================================
 */

// Função para salvar o estado no LocalStorage
function saveState() {
    // Salva o ID do usuário logado para simular a sessão
    const stateToSave = { ...appState, currentUserId: appState.currentUser ? appState.currentUser.id : null };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
}

// Função para carregar o estado do LocalStorage e restaurar a sessão
function loadState() {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (serializedState === null) {
        return initialAppState;
    }
    
    const loadedState = JSON.parse(serializedState);
    
    // RESTAURAÇÃO DA SESSÃO: Encontra o usuário a partir do ID salvo
    if (loadedState.currentUserId) {
        loadedState.currentUser = loadedState.users.find(u => u.id === loadedState.currentUserId) || null;
    } else {
        loadedState.currentUser = null;
    }
    
    // Assegura que currentDate seja um objeto Date
    loadedState.currentDate = new Date(loadedState.currentDate);
    
    // Garante que o admin padrão exista
    if (!loadedState.users.find(u => u.id === 'admin')) {
        loadedState.users.push(initialAppState.users.find(u => u.id === 'admin'));
    }
    
    return loadedState;
}

// Função para formatar números para moeda BRL (R$)
const formatCurrency = (value) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Formata a data para exibição na lista usando dateFns global
const formatDate = (dateString) => {
    // Agora usando o objeto global 'dateFns'
    return dateFns.format(dateFns.parseISO(dateString), 'dd/MM/yyyy');
};

/**
 * ========================================
 * 3. LÓGICA DE AUTENTICAÇÃO E RENDERIZAÇÃO INICIAL
 * ========================================
 */

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;
    const errorDisplay = document.getElementById('login-error');

    const user = appState.users.find(u => u.username === username && u.password === password);

    if (user) {
        appState.currentUser = user;
        user.lastLogin = new Date().toISOString();
        
        // CORREÇÃO CRÍTICA: Salvar o estado ANTES de atualizar a UI
        saveState();
        
        // Esconde login e mostra o app
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        // Inicializa a interface do usuário logado
        initializeAppUI();
        
    } else {
        errorDisplay.classList.remove('hidden');
        setTimeout(() => errorDisplay.classList.add('hidden'), 3000);
    }
}

function handleLogout() {
    appState.currentUser = null;
    saveState();
    
    // Limpar e retornar à tela de login
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}


function checkAuthAndInit() {
    if (appState.currentUser) {
        // Usuário encontrado na sessão (localStorage)
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        initializeAppUI();
    } else {
        // Sem sessão, mostra a tela de login
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }
}

/**
 * ========================================
 * 4. LÓGICA DE TRANSAÇÕES
 * ========================================
 */

function getTransactionsForCurrentUserMonth() {
    if (!appState.currentUser) return [];

    const currentMonth = appState.currentDate.getMonth();
    const currentYear = appState.currentDate.getFullYear();
    const userId = appState.currentUser.id;

    return appState.transactions
        .filter(t => t.userId === userId) // Filtra apenas as do usuário logado
        .filter(t => {
            const tDate = dateFns.parseISO(t.date);
            return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
        })
        .sort((a, b) => b.timestamp - a.timestamp);
}

// Função principal de cálculo e atualização da UI
function updateSummary() {
    const filteredTransactions = getTransactionsForCurrentUserMonth();
    
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach(t => {
        if (t.type === 'income') {
            income += t.amount;
        } else {
            expense += t.amount;
        }
    });

    const balance = income - expense;

    document.getElementById('summary-income').textContent = formatCurrency(income);
    document.getElementById('summary-expense').textContent = formatCurrency(expense);
    document.getElementById('summary-balance').textContent = formatCurrency(balance);
    
    updateExpenseChart(filteredTransactions);
    renderTransactionList(filteredTransactions);
}

/**
 * Gerencia a lógica de repetição de gastos/rendas e adiciona ao estado.
 */
function addTransaction(data) {
    const amount = parseFloat(data.get('amount'));
    const recurrence = parseInt(data.get('recurrence'), 10);
    const dateInput = data.get('date');
    const timeInput = data.get('time') || '12:00';
    
    const baseTransaction = {
        id: Date.now(),
        userId: appState.currentUser.id,
        type: data.get('type'),
        amount: amount,
        category: data.get('category'),
        description: data.get('description'),
        date: dateInput,
        timestamp: Date.parse(`${dateInput}T${timeInput}`),
        recurrence: recurrence,
    };
    appState.transactions.push(baseTransaction);

    // Adiciona as transações recorrentes
    if (recurrence > 1) {
        let currentDate = dateFns.parseISO(dateInput);
        for (let i = 1; i < recurrence; i++) {
            currentDate = dateFns.addMonths(currentDate, 1);
            
            const repeatedTransaction = {
                ...baseTransaction,
                id: Date.now() + i,
                date: dateFns.format(currentDate, 'yyyy-MM-dd'),
                timestamp: currentDate.getTime(),
                isRecurring: true, 
                recurrenceIndex: i + 1,
            };
            appState.transactions.push(repeatedTransaction);
        }
    }
    
    saveState();
    updateSummary();
}

/**
 * Exclui uma transação do estado.
 */
function deleteTransaction(id) {
    appState.transactions = appState.transactions.filter(t => t.id !== id);
    saveState();
    updateSummary();
    if (appState.currentUser.role === 'admin') {
        renderAdminView();
    }
}

/**
 * ========================================
 * 5. LÓGICA DE RENDERIZAÇÃO
 * ========================================
 */

function initializeAppUI() {
    document.getElementById('user-name').textContent = appState.currentUser.username;
    
    // Mostra/Esconde a aba Admin
    const adminNav = document.getElementById('nav-admin');
    if (appState.currentUser.role === 'admin') {
        adminNav.classList.remove('hidden');
    } else {
        adminNav.classList.add('hidden');
    }
    
    // Atualiza o estado da aplicação
    updateMonthDisplay();
    updateSummary();
}

function updateMonthDisplay() {
    const monthYear = appState.currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('current-month').textContent = 
        monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
}

function renderTransactionList(transactions) {
    const listContainer = document.getElementById('transaction-list');
    const latestListContainer = document.getElementById('latest-transaction-list');
    listContainer.innerHTML = '';
    latestListContainer.innerHTML = '';

    // Extrato Completo (com botão de exclusão)
    transactions.forEach(t => {
        listContainer.innerHTML += createTransactionHTML(t, true);
    });
    
    // Últimos Lançamentos (Home View, sem botão de exclusão)
    transactions.slice(0, 5).forEach(t => {
        latestListContainer.innerHTML += createTransactionHTML(t, false);
    });
    
    if (transactions.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Nenhum lançamento neste mês.</p>';
    }

    // Adiciona event listeners para exclusão
    document.querySelectorAll('.btn-delete-transaction').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('button').dataset.id);
            if (confirm("Tem certeza que deseja excluir esta transação?")) {
                deleteTransaction(id);
            }
        });
    });
}

function createTransactionHTML(t, showDeleteButton) {
    const typeClass = t.type;
    const sign = t.type === 'income' ? '+' : '-';
    const date = formatDate(t.date);

    const deleteButton = showDeleteButton ? 
        `<button class="btn-delete-transaction icon-btn" data-id="${t.id}" title="Excluir"><i class="fa-solid fa-trash-can" data-id="${t.id}"></i></button>` : '';

    return `
        <div class="transaction-item ${typeClass}">
            <div class="transaction-details">
                <h4>${t.description || t.category}</h4>
                <span>${t.category} - ${date} ${t.isRecurring ? '(Recorrente)' : ''}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="transaction-amount ${typeClass}">
                    ${sign} ${formatCurrency(t.amount)}
                </div>
                ${deleteButton}
            </div>
        </div>
    `;
}

/**
 * Lógica da Tela Admin
 */
function renderAdminView() {
    if (appState.currentUser.role !== 'admin') return;

    // --- Renderizar Lista de Usuários ---
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    
    appState.users.forEach(user => {
        const lastLoginText = user.lastLogin ? dateFns.format(dateFns.parseISO(user.lastLogin), 'dd/MM/yyyy HH:mm') : 'Nunca';
        const deleteBtn = user.id !== 'admin' ? 
            `<button class="btn outline small btn-delete-user" data-id="${user.id}">Excluir</button>` : '';
            
        userList.innerHTML += `
            <div class="user-item">
                <div class="user-info">
                    <strong>${user.username}</strong> (${user.role === 'admin' ? 'Administrador' : 'Padrão'})
                    <span>Último Login: ${lastLoginText}</span>
                </div>
                <div class="actions">
                    <button class="btn primary small btn-edit-user" data-id="${user.id}">Editar</button>
                    ${deleteBtn}
                </div>
            </div>
        `;
    });

    // Adiciona listeners para excluir usuários
    document.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            if (confirm(`Tem certeza que deseja excluir o usuário ${id}?`)) {
                deleteUser(id);
            }
        });
    });
    
    // Adiciona listeners para editar usuários
    document.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            openUserModal(id);
        });
    });


    // --- Renderizar Histórico Global ---
    const globalHistory = document.getElementById('global-history');
    globalHistory.innerHTML = '';

    // Transações de todos os usuários, ordenadas
    const allTransactions = [...appState.transactions].sort((a, b) => b.timestamp - a.timestamp);
    
    allTransactions.forEach(t => {
        const owner = appState.users.find(u => u.id === t.userId)?.username || 'Desconhecido';
        const typeClass = t.type;
        const sign = t.type === 'income' ? '+' : '-';
        const date = formatDate(t.date);

        globalHistory.innerHTML += `
            <div class="transaction-item ${typeClass}" style="border-left-width: 10px;">
                <div class="transaction-details">
                    <h4>${t.description || t.category} (${owner})</h4>
                    <span>${t.category} - ${date}</span>
                </div>
                <div class="transaction-amount ${typeClass}">
                    ${sign} ${formatCurrency(t.amount)}
                </div>
            </div>
        `;
    });
}

function deleteUser(userId) {
    appState.users = appState.users.filter(u => u.id !== userId);
    appState.transactions = appState.transactions.filter(t => t.userId !== userId); 
    saveState();
    renderAdminView();
}

function openUserModal(userId = null) {
    // ... (Mantém a lógica de abrir/preencher modal de usuário)
    const modal = document.getElementById('modal-user-overlay');
    const form = document.getElementById('form-add-user');
    const title = document.getElementById('modal-user-title');
    
    if (userId) {
        const user = appState.users.find(u => u.id === userId);
        title.textContent = `Editar Usuário: ${user.username}`;
        form.querySelector('#edit-user-id').value = user.id;
        form.querySelector('#new-username').value = user.username;
        form.querySelector('#new-password').placeholder = 'Deixe vazio para manter a senha';
        form.querySelector('#new-role').value = user.role;
        if (user.id === 'admin') {
            form.querySelector('#new-role').disabled = true;
        } else {
            form.querySelector('#new-role').disabled = false;
        }
    } else {
        title.textContent = 'Criar Novo Usuário';
        form.reset();
        form.querySelector('#edit-user-id').value = '';
        form.querySelector('#new-password').placeholder = '12345';
        form.querySelector('#new-role').disabled = false;
    }
    
    modal.classList.remove('hidden');
}


/**
 * ========================================
 * 6. SETUP E EVENT LISTENERS
 * ========================================
 */

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetView = button.dataset.view;

            navButtons.forEach(btn => btn.classList.remove('active'));
            views.forEach(view => view.classList.add('hidden'));
            views.forEach(view => view.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`view-${targetView}`).classList.remove('hidden');
            document.getElementById(`view-${targetView}`).classList.add('active');

            if (targetView === 'admin' && appState.currentUser.role === 'admin') {
                renderAdminView();
            } else if (targetView === 'home' || targetView === 'transactions') {
                updateSummary();
            }
        });
    });
}

function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    // Troca de Mês
    document.getElementById('prev-month').addEventListener('click', () => {
        appState.currentDate = dateFns.addMonths(appState.currentDate, -1);
        updateMonthDisplay();
        updateSummary();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        appState.currentDate = dateFns.addMonths(appState.currentDate, 1);
        updateMonthDisplay();
        updateSummary();
    });

    // Modal de Transação
    const modalOverlay = document.getElementById('modal-overlay');
    document.getElementById('btn-open-modal').addEventListener('click', () => modalOverlay.classList.remove('hidden'));
    document.getElementById('close-modal').addEventListener('click', () => modalOverlay.classList.add('hidden'));
    document.getElementById('cancel-modal').addEventListener('click', () => modalOverlay.classList.add('hidden'));
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
    });

    // Form de Nova Transação
    document.getElementById('form-add-transaction').addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        addTransaction(formData);
        this.reset();
        modalOverlay.classList.add('hidden');
        this.querySelector('input[name="date"]').value = dateFns.format(new Date(), 'yyyy-MM-dd');
    });

    // Admin Modals
    const userModalOverlay = document.getElementById('modal-user-overlay');
    document.getElementById('btn-add-user').addEventListener('click', () => openUserModal(null));
    document.querySelectorAll('[data-close-user-modal]').forEach(btn => {
        btn.addEventListener('click', () => userModalOverlay.classList.add('hidden'));
    });
    userModalOverlay.addEventListener('click', (e) => {
        if (e.target === userModalOverlay) userModalOverlay.classList.add('hidden');
    });
    
    // Form de Adicionar/Editar Usuário
    document.getElementById('form-add-user').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const userId = formData.get('userId');

        if (userId) { // Edição
            const user = appState.users.find(u => u.id === userId);
            user.username = formData.get('newUsername');
            if (formData.get('newPassword')) {
                user.password = formData.get('newPassword');
            }
            if (user.id !== 'admin') { 
                user.role = formData.get('newRole');
            }
        } else { // Criação
            const newId = `user${Date.now()}`;
            const newUser = {
                id: newId,
                username: formData.get('newUsername'),
                password: formData.get('newPassword') || '12345',
                role: formData.get('newRole'),
                lastLogin: null,
            };
            appState.users.push(newUser);
        }

        saveState();
        userModalOverlay.classList.add('hidden');
        renderAdminView();
    });
}

// Inicialização Principal
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuthAndInit(); // Checa se há uma sessão ativa e inicia o app
    
    // Preenche a data do formulário inicialmente
    document.querySelector('#form-add-transaction input[name="date"]').value = dateFns.format(new Date(), 'yyyy-MM-dd');
});
