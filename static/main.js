// Générateur d'URL Grist - JavaScript principal
document.addEventListener('DOMContentLoaded', function() {
    
    // Variables globales
    const elements = {
        docIdInput: document.getElementById('doc_id'),
        testApiBtn: document.getElementById('testApiBtn'),
        loadTablesBtn: document.getElementById('loadTablesBtn'),
        tableSelect: document.getElementById('table_name'),
        columnSelect: document.getElementById('column_name'),
        generateBtn: document.getElementById('generateBtn'),
        form: document.getElementById('urlForm'),
        loading: document.getElementById('loading'),
        result: document.getElementById('result'),
        modal: document.getElementById('modal'),
        modalTitle: document.getElementById('modal-title'),
        modalText: document.getElementById('modal-text')
    };

    let currentUrl = null;

    // Utilitaires pour les modales
    function showModal(title, message, isError = false) {
        elements.modalTitle.textContent = title;
        elements.modalText.textContent = message;
        elements.modal.setAttribute('aria-hidden', 'false');
        elements.modal.classList.add('fr-modal--opened');
    }

    function hideModal() {
        elements.modal.setAttribute('aria-hidden', 'true');
        elements.modal.classList.remove('fr-modal--opened');
    }

    // Gestionnaires pour la modale
    elements.modal.querySelectorAll('.fr-btn--close').forEach(btn => {
        btn.addEventListener('click', hideModal);
    });

    // Fermer la modale avec Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && elements.modal.classList.contains('fr-modal--opened')) {
            hideModal();
        }
    });

    // Utilitaires pour les boutons de chargement
    function setButtonLoading(button, isLoading, originalText = null) {
        if (isLoading) {
            button.dataset.originalText = originalText || button.textContent;
            button.textContent = 'Chargement...';
            button.classList.add('fr-btn--loading');
            button.disabled = true;
        } else {
            button.textContent = button.dataset.originalText || originalText;
            button.classList.remove('fr-btn--loading');
            button.disabled = false;
            delete button.dataset.originalText;
        }
    }

    // Test de la clé API
    elements.testApiBtn.addEventListener('click', async function() {
        console.log('Test de la clé API lancé');
        
        setButtonLoading(this, true, 'Tester la clé API');
        
        try {
            console.log('Appel vers /test_api');
            const response = await fetch('/test_api');
            console.log('Réponse:', response.status);
            const data = await response.json();
            console.log('Données reçues:', data);
            
            if (data.success) {
                showModal('Test réussi', `✅ ${data.message}`);
            } else {
                showModal('Erreur de clé API', `Problème avec la clé API :\n\n${data.message}\n\nVérifiez votre fichier .env`, true);
            }
        } catch (error) {
            console.error('Erreur complète:', error);
            showModal('Erreur de test', `Erreur de test: ${error.message}\n\nVérifiez que l'application Flask fonctionne.`, true);
        }
        
        setButtonLoading(this, false);
    });

    // Fonction pour nettoyer les résultats de test
    function clearTestResults() {
        const existingTestResults = document.querySelectorAll('[data-test-result]');
        existingTestResults.forEach(result => result.remove());
    }

    // Activation du bouton de chargement quand un DOC_ID est saisi
    elements.docIdInput.addEventListener('input', function() {
        console.log('DOC ID saisi:', this.value.trim());
        const hasValue = this.value.trim().length > 0;
        elements.loadTablesBtn.disabled = !hasValue;
        
        // Reset des autres champs quand l'ID change
        elements.tableSelect.innerHTML = '<option value="">-- Charger d\'abord les tables --</option>';
        elements.tableSelect.disabled = true;
        elements.columnSelect.innerHTML = '<option value="">-- Choisir d\'abord une table --</option>';
        elements.columnSelect.disabled = true;
        elements.generateBtn.disabled = true;
        elements.result.style.display = 'none';
        clearTestResults();
        currentUrl = null;
    });

    // Chargement des tables
    elements.loadTablesBtn.addEventListener('click', async function() {
        const docId = elements.docIdInput.value.trim();
        
        console.log('Chargement des tables pour DOC ID:', docId);
        
        if (!docId) {
            showModal('Erreur', 'Veuillez saisir un ID de document', true);
            return;
        }

        setButtonLoading(this, true, 'Charger les tables');

        try {
            console.log('Appel API vers:', `/api/tables/${docId}`);
            const response = await fetch(`/api/tables/${docId}`);
            console.log('Réponse API:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            }
            
            const tables = await response.json();
            console.log('Tables reçues:', tables);
            
            if (tables && tables.length > 0) {
                elements.tableSelect.innerHTML = '<option value="">-- Choisir une table --</option>';
                tables.forEach(table => {
                    const option = document.createElement('option');
                    option.value = table;
                    option.textContent = table;
                    elements.tableSelect.appendChild(option);
                });
                elements.tableSelect.disabled = false;
                
                // Afficher un message de succès temporaire
                const originalText = this.textContent;
                this.textContent = `✓ ${tables.length} tables chargées`;
                this.classList.add('fr-btn--success');
                
                setTimeout(() => {
                    this.textContent = originalText;
                    this.classList.remove('fr-btn--success');
                }, 2000);
            } else {
                elements.tableSelect.innerHTML = '<option value="">-- Aucune table trouvée --</option>';
                showModal('Aucune table trouvée', `Aucune table trouvée.\n\nVérifiez l'ID du document et votre clé API dans le fichier .env`, true);
            }
        } catch (error) {
            console.error('Erreur complète:', error);
            showModal('Erreur de connexion', `Erreur de connexion: ${error.message}\n\nVérifiez :\n- L'ID du document\n- Votre clé API dans .env\n- Les permissions du document`, true);
        }
        
        setButtonLoading(this, false);
    });

    // Chargement des colonnes quand une table est sélectionnée
    elements.tableSelect.addEventListener('change', async function() {
        const docId = elements.docIdInput.value.trim();
        const tableName = this.value;
        
        elements.columnSelect.innerHTML = '<option value="">-- Chargement... --</option>';
        elements.columnSelect.disabled = true;
        elements.generateBtn.disabled = true;
        elements.result.style.display = 'none';
        clearTestResults();
        currentUrl = null;

        if (tableName && docId) {
            try {
                const response = await fetch(`/api/columns/${docId}/${tableName}`);
                const columns = await response.json();
                
                elements.columnSelect.innerHTML = '<option value="">-- Choisir une colonne --</option>';
                columns.forEach(column => {
                    const option = document.createElement('option');
                    option.value = column;
                    option.textContent = column;
                    elements.columnSelect.appendChild(option);
                });
                elements.columnSelect.disabled = false;
            } catch (error) {
                elements.columnSelect.innerHTML = '<option value="">-- Erreur de chargement --</option>';
                console.error('Erreur:', error);
                showModal('Erreur', `Erreur lors du chargement des colonnes: ${error.message}`, true);
            }
        } else {
            elements.columnSelect.innerHTML = '<option value="">-- Choisir d\'abord une table --</option>';
        }
    });

    // Activation du bouton quand une colonne est sélectionnée
    elements.columnSelect.addEventListener('change', function() {
        elements.generateBtn.disabled = !this.value;
        elements.result.style.display = 'none';
        clearTestResults();
        currentUrl = null;
    });

    // Fonction pour afficher les résultats de succès
    function showSuccessResult(data) {
        const template = document.getElementById('result-success-template');
        const clone = template.content.cloneNode(true);
        
        // Remplir les données
        clone.getElementById('generated-url').textContent = data.url;
        clone.getElementById('doc-name').textContent = data.doc_name || 'Nom non disponible';
        clone.getElementById('doc-id').textContent = data.doc_id;
        clone.getElementById('table-name').textContent = data.table;
        clone.getElementById('column-name').textContent = data.column;
        clone.getElementById('format-info').textContent = data.format_info;
        clone.getElementById('usage-info').textContent = data.usage;
        
        // Ajouter les gestionnaires d'événements
        const copyBtn = clone.getElementById('copyBtn');
        const testUrlBtn = clone.getElementById('testUrlBtn');
        
        copyBtn.addEventListener('click', () => copyToClipboard(data.url));
        testUrlBtn.addEventListener('click', () => testGeneratedUrl(data.url));
        
        // Afficher le résultat
        elements.result.innerHTML = '';
        elements.result.appendChild(clone);
        elements.result.style.display = 'block';
        
        // Sauvegarder l'URL courante
        currentUrl = data.url;
    }

    // Fonction pour afficher les résultats d'erreur
    function showErrorResult(errorMessage) {
        const template = document.getElementById('result-error-template');
        const clone = template.content.cloneNode(true);
        
        clone.getElementById('error-message').textContent = errorMessage;
        
        elements.result.innerHTML = '';
        elements.result.appendChild(clone);
        elements.result.style.display = 'block';
    }

    // Génération de l'URL
    elements.form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        elements.loading.style.display = 'block';
        elements.result.style.display = 'none';
        setButtonLoading(elements.generateBtn, true, 'Générer l\'URL');

        try {
            const response = await fetch('/generate_url', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            console.log('🔍 Données reçues du serveur:', data);
            
            if (response.ok) {
                showSuccessResult(data);
            } else {
                showErrorResult(data.error || 'Erreur inconnue');
            }
            
        } catch (error) {
            console.error('🔥 Erreur lors de la génération:', error);
            showErrorResult(`Erreur de connexion: ${error.message}`);
        }
        
        elements.loading.style.display = 'none';
        setButtonLoading(elements.generateBtn, false);
    });

    // Fonction pour copier dans le presse-papiers
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showModal('Copié !', 'URL copiée dans le presse-papiers !');
        }).catch(err => {
            console.error('Erreur de copie:', err);
            // Fallback pour les navigateurs plus anciens
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showModal('Copié !', 'URL copiée dans le presse-papiers !');
        });
    }

    // Fonction pour tester l'URL générée
    async function testGeneratedUrl(url) {
        console.log('Test de l\'URL:', url);
        
        // Remplacer {id} par une valeur de test
        const testId = prompt('Entrez une valeur de test pour remplacer {id}:', 'LPA');
        if (!testId) return;
        
        console.log('Valeur de test:', testId);
        
        // Supprimer les résultats de test précédents
        const existingTestResults = document.querySelectorAll('[data-test-result]');
        existingTestResults.forEach(result => result.remove());
        
        // Afficher le résultat de test
        await showTestResult(url, testId);
    }

    // Fonction pour afficher les résultats de test
    async function showTestResult(url, testId) {
        const template = document.getElementById('test-result-template');
        const clone = template.content.cloneNode(true);
        
        // Marquer comme résultat de test pour pouvoir le supprimer
        const testContainer = document.createElement('div');
        testContainer.setAttribute('data-test-result', 'true');
        testContainer.appendChild(clone);
        
        // Ajouter après le résultat principal
        elements.result.appendChild(testContainer);
        
        const rawResult = testContainer.querySelector('#raw-result');
        const accordionTitle = testContainer.querySelector('#accordion-title');
        const accordionBtn = testContainer.querySelector('.fr-accordion__btn');
        const accordionCollapse = testContainer.querySelector('.fr-collapse');
        
        // Afficher le chargement
        rawResult.textContent = 'Chargement...';
        accordionTitle.textContent = 'Chargement des résultats...';
        
        try {
            console.log('Appel à /test_url avec:', { url, test_value: testId });
            
            // Appeler la route Flask pour tester l'URL
            const response = await fetch('/test_url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url,
                    test_value: testId
                })
            });
            
            const result = await response.json();
            console.log('Résultat du test:', result);
            
            if (result.success) {
                const data = result.data;
                const recordCount = data.records ? data.records.length : 0;
                
                // Afficher le JSON brut
                rawResult.textContent = JSON.stringify(data, null, 2);
                
                // Mettre à jour le titre de l'accordéon
                accordionTitle.textContent = `Résultat JSON (${recordCount} enregistrement${recordCount > 1 ? 's' : ''} trouvé${recordCount > 1 ? 's' : ''})`;
                
                // Ouvrir l'accordéon automatiquement
                accordionBtn.setAttribute('aria-expanded', 'true');
                accordionCollapse.classList.add('fr-collapse--expanded');
                
            } else {
                // Afficher l'erreur
                rawResult.textContent = `Erreur: ${result.error}`;
                accordionTitle.textContent = `Erreur lors du test`;
                
                // Ouvrir l'accordéon pour montrer l'erreur
                accordionBtn.setAttribute('aria-expanded', 'true');
                accordionCollapse.classList.add('fr-collapse--expanded');
            }
            
        } catch (error) {
            console.error('Erreur lors du test:', error);
            rawResult.textContent = `Erreur: ${error.message}`;
            accordionTitle.textContent = `Erreur de connexion`;
            
            // Ouvrir l'accordéon pour montrer l'erreur
            accordionBtn.setAttribute('aria-expanded', 'true');
            accordionCollapse.classList.add('fr-collapse--expanded');
        }
        
        // Réinitialiser le JavaScript DSFR pour les nouveaux composants
        // Ou utiliser un fallback si DSFR ne fonctionne pas
        setTimeout(() => {
            if (typeof window.dsfr !== 'undefined' && window.dsfr.accordions) {
                window.dsfr.accordions.init();
            } else {
                // Fallback : ajouter un gestionnaire d'événements manuel
                initAccordionFallback(testContainer);
            }
        }, 100);
    }

    // Fonction fallback pour l'accordéon si DSFR ne fonctionne pas
    function initAccordionFallback(container) {
        const accordionBtn = container.querySelector('.fr-accordion__btn');
        const accordionCollapse = container.querySelector('.fr-collapse');
        
        if (accordionBtn && accordionCollapse) {
            // Supprimer les anciens gestionnaires d'événements
            accordionBtn.replaceWith(accordionBtn.cloneNode(true));
            const newAccordionBtn = container.querySelector('.fr-accordion__btn');
            
            newAccordionBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const isExpanded = this.getAttribute('aria-expanded') === 'true';
                
                if (isExpanded) {
                    this.setAttribute('aria-expanded', 'false');
                    accordionCollapse.classList.remove('fr-collapse--expanded');
                } else {
                    this.setAttribute('aria-expanded', 'true');
                    accordionCollapse.classList.add('fr-collapse--expanded');
                }
            });
            
            console.log('Accordéon fallback initialisé');
        }
    }

    // Fonction pour initialiser les onglets DSFR
    function initTabs(container) {
        const tabs = container.querySelectorAll('.fr-tabs__tab');
        const panels = container.querySelectorAll('.fr-tabs__panel');
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                // Désactiver tous les onglets
                tabs.forEach(t => {
                    t.setAttribute('aria-selected', 'false');
                    t.setAttribute('tabindex', '-1');
                });
                
                // Cacher tous les panneaux
                panels.forEach(p => {
                    p.classList.remove('fr-tabs__panel--selected');
                });
                
                // Activer l'onglet cliqué
                tab.setAttribute('aria-selected', 'true');
                tab.setAttribute('tabindex', '0');
                
                // Afficher le panneau correspondant
                const targetPanel = container.querySelector('#' + tab.getAttribute('aria-controls'));
                if (targetPanel) {
                    targetPanel.classList.add('fr-tabs__panel--selected');
                }
            });
        });
    }

    // Initialisation
    console.log('🚀 Application initialisée');
});