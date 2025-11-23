// app.js

/**
 * ========================================
 * 1. VARIÁVEIS E ESTADO GLOBAL
 * ========================================
 */

const STORAGE_KEY = 'financeFamState';

const initialAppState = {
    userName: "Usuário",
    // Data para controle do mês (Novembro de 2025 para exemplo)
    currentDate: new Date(2025, 10, 23), 
    transactions: [],
    // Dados de exemplo para Metas/Cofre (simplificado)
    savingsTotal: 500.00, 
    goals: [
        { id: 1, name: 'Viagem Europa 🇪🇺', target: 10000.00, saved: 1500.00 },
    ]
};

// Carrega o estado do localStorage ou usa o inicial
let appState = loadState();

/**
 * ========================================
 * 2. FUNÇÕES AUXILIARES
 * ========================================
 */

// Função para formatar números para moeda BRL (R$)
const formatCurrency = (value) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Função para salvar o estado no LocalStorage
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// Função para carregar o estado do LocalStorage
function loadState() {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (serializedState === null) {
        // Se não houver dados, inicializa com alguns exemplos
        initialAppState.transactions = [
            { id: 1, type: 'income', amount: 3000.00, category: 'Salário', description: 'Renda Mensal', date: '2025-11-05', timestamp: Date.parse('2025-11-05T09:00:00') },
            { id: 2, type: 'expense', amount: 120.00, category: 'Alimentação', description: 'Mercado Semanal', date: '2025-11-12', timestamp: Date.parse('2025-11-12T18:30:00') },
            { id: 3, type: 'expense', amount: 1200.00, category: 'Contas Fixas', description: 'Aluguel', date: '2025-11-01', timestamp: Date.parse('2025-11-01T10:00:00') },
            { id: 4, type: 'income', amount: 500.00, category: 'Renda Extra', description: 'Freelance', date: '2025-11-20', timestamp: Date.parse('2025-11-20T14:00:00') },
        ];
        // Assegura que currentDate seja um objeto Date
        initialAppState.currentDate = new Date(initialAppState.currentDate); 
        return initialAppState;
    }
    const loadedState = JSON.parse(serializedState);
    // Assegura que currentDate seja um objeto Date
    loadedState.currentDate = new Date(loadedState.currentDate);
    return loadedState;
}

/**
 * ========================================
 * 3. LÓGICA DE CÁLCULO E RENDERIZAÇÃO
 * ========================================
 */

// Referência global para o gráfico
let expensesChart;

/**
 * Filtra transações pelo mês e ano atual e atualiza os cartões de resumo.
 */
function updateSummary() {
    const currentMonth = appState.currentDate.getMonth();
    const currentYear = appState.currentDate.getFullYear();

    const filteredTransactions = appState.transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

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

    // Atualiza o DOM
    document.getElementById('summary-income').textContent = formatCurrency(income);
    document.getElementById('summary-expense').textContent = formatCurrency(expense);
    document.getElementById('summary-balance').textContent = formatCurrency(balance);
    
    // Atualiza o gráfico e as listas
    updateExpenseChart(filteredTransactions);
    renderTransactionList(filteredTransactions);
}

/**
 * Atualiza o display do mês na topbar.
 */
function updateMonthDisplay() {
    const monthYear = appState.currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('current-month').textContent = 
        monthYear.charAt(0).toUpperCase() + monthYear.slice(1); // Capitaliza
}

/**
 * Renderiza a lista de transações (Extrato e Últimos Lançamentos).
 * @param {Array} transactions - Lista de transações a serem exibidas.
 */
function renderTransactionList(transactions) {
    const listContainer = document.getElementById('transaction-list');
    const latestListContainer = document.getElementById('latest-transaction-list');
    listContainer.innerHTML = '';
    latestListContainer.innerHTML = '';

    // Ordena pela data/hora mais recente
    const sortedTransactions = [...transactions].sort((a, b) => b.timestamp - a.timestamp);

    // Renderiza o Extrato Completo
    sortedTransactions.forEach(t => {
        listContainer.innerHTML += createTransactionHTML(t);
    });
    
    // Renderiza os 5 Últimos Lançamentos (Home View)
    sortedTransactions.slice(0, 5).forEach(t => {
        latestListContainer.innerHTML += createTransactionHTML(t);
    });
    
    // Se a lista estiver vazia
    if (transactions.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Nenhum lançamento neste mês.</p>';
    }
}

/**
 * Gera o HTML para uma única transação.
 */
function createTransactionHTML(t) {
    const typeClass = t.type;
    const sign = t.type === 'income' ? '+' : '-';
    const date = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    return `
        <div class="transaction-item ${typeClass}">
            <div class="transaction-details">
                <h4>${t.description || t.category}</h4>
                <span>${t.category} - ${date}</span>
            </div>
            <div class="transaction-amount ${typeClass}">
                ${sign} ${formatCurrency(t.amount)}
            </div>
        </div>
    `;
}

/**
 * Inicializa ou atualiza o gráfico de despesas por categoria.
 */
function updateExpenseChart(transactions) {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    const categoryTotals = expenseTransactions.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
    }, {});

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    
    // Destrói a instância anterior se existir
    if (expensesChart) {
        expensesChart.destroy();
    }

    const ctx = document.getElementById('chart-expenses').getContext('2d');
    expensesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40'
                ],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: false,
                }
            }
        }
    });
}

/**
 * ========================================
 * 4. INICIALIZAÇÃO E EVENT LISTENERS
 * ========================================
 */

function initializeApp() {
    // 1. Atualiza dados iniciais
    document.getElementById('user-name').textContent = appState.userName;
    updateMonthDisplay();
    updateSummary();

    // 2. Setup dos Event Listeners (UI)
    setupNavigation();
    setupMonthSwitchers();
    setupModal();
    setupTransactionForm();
}

/**
 * Configura a troca de views (navegação lateral).
 */
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetView = button.dataset.view;

            // Remove 'active' de todos os botões e views
            navButtons.forEach(btn => btn.classList.remove('active'));
            views.forEach(view => view.classList.add('hidden'));
            views.forEach(view => view.classList.remove('active'));

            // Adiciona 'active' ao botão e view corretos
            button.classList.add('active');
            document.getElementById(`view-${targetView}`).classList.remove('hidden');
            document.getElementById(`view-${targetView}`).classList.add('active');
        });
    });
}

/**
 * Configura os botões de troca de mês.
 */
function setupMonthSwitchers() {
    // Botão Mês Anterior
    document.getElementById('prev-month').addEventListener('click', () => {
        appState.currentDate.setMonth(appState.currentDate.getMonth() - 1);
        updateMonthDisplay();
        updateSummary(); // Recalcula e redesenha
    });

    // Botão Próximo Mês
    document.getElementById('next-month').addEventListener('click', () => {
        appState.currentDate.setMonth(appState.currentDate.getMonth() + 1);
        updateMonthDisplay();
        updateSummary(); // Recalcula e redesenha
    });
}

/**
 * Configura o modal de novo lançamento.
 */
function setupModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    const openModalBtn = document.getElementById('btn-open-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelModalBtn = document.getElementById('cancel-modal');

    const openModal = () => modalOverlay.classList.remove('hidden');
    const closeModal = () => modalOverlay.classList.add('hidden');

    openModalBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    
    // Fechar ao clicar fora do modal
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}

/**
 * Configura o formulário para adicionar transação.
 */
function setupTransactionForm() {
    const form = document.getElementById('form-add-transaction');

    // Preenche a data com a data atual por padrão
    const today = new Date().toISOString().split('T')[0];
    form.querySelector('input[name="date"]').value = today;

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const formData = new FormData(this);
        const dateInput = formData.get('date');
        const timeInput = formData.get('time') || '12:00:00'; // Default time

        const newTransaction = {
            id: Date.now(),
            type: formData.get('type'),
            amount: parseFloat(formData.get('amount')),
            category: formData.get('category'),
            description: formData.get('description'),
            date: dateInput,
            // Cria um timestamp unificado para ordenação
            timestamp: Date.parse(`${dateInput}T${timeInput}`), 
        };

        appState.transactions.push(newTransaction);
        
        // Salva e atualiza a UI
        saveState();
        updateSummary();
        
        // Reseta e fecha o modal
        this.reset();
        document.getElementById('modal-overlay').classList.add('hidden');
        
        // Coloca a data atual novamente para a próxima vez
        form.querySelector('input[name="date"]').value = today; 
    });
}


// Chama a função de inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeApp);

// Exporta (apenas se fosse um módulo, mas mantém a estrutura)
window.appState = appState;
window.updateSummary = updateSummary;
