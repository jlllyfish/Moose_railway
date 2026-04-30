// Générateur d'URL Grist - JavaScript principal
document.addEventListener("DOMContentLoaded", function () {
  // Variables globales
  const elements = {
    apiKeyInput: document.getElementById("api_key"),
    docIdInput: document.getElementById("doc_id"),
    testApiBtn: document.getElementById("testApiBtn"),
    loadTablesBtn: document.getElementById("loadTablesBtn"),
    tableSelect: document.getElementById("table_name"),
    columnSelect: document.getElementById("column_name"),
    generateBtn: document.getElementById("generateBtn"),
    form: document.getElementById("urlForm"),
    loading: document.getElementById("loading"),
    result: document.getElementById("result"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modal-title"),
    modalText: document.getElementById("modal-text"),
  };

  let currentUrl = null;

  // Helper pour récupérer l'API key
  const getApiKey = () => elements.apiKeyInput.value.trim();

  // Helper pour créer les headers avec l'API key
  const getHeaders = () => {
    const apiKey = getApiKey();
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  };

  // Utilitaires pour les modales
  function showModal(title, message, isError = false) {
    elements.modalTitle.textContent = title;
    elements.modalText.textContent = message;
    elements.modal.setAttribute("aria-hidden", "false");
    elements.modal.classList.add("fr-modal--opened");
  }

  function hideModal() {
    elements.modal.setAttribute("aria-hidden", "true");
    elements.modal.classList.remove("fr-modal--opened");
  }

  // Gestionnaires pour la modale
  elements.modal.querySelectorAll(".fr-btn--close").forEach((btn) => {
    btn.addEventListener("click", hideModal);
  });

  // Fermer la modale avec Escape
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "Escape" &&
      elements.modal.classList.contains("fr-modal--opened")
    ) {
      hideModal();
    }
  });

  // Utilitaires pour les boutons de chargement
  function setButtonLoading(button, isLoading, originalText = null) {
    if (isLoading) {
      button.dataset.originalText = originalText || button.textContent;
      button.textContent = "Chargement...";
      button.classList.add("fr-btn--loading");
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || originalText;
      button.classList.remove("fr-btn--loading");
      button.disabled = false;
      delete button.dataset.originalText;
    }
  }

  // Test de la clé API
  elements.testApiBtn.addEventListener("click", async function () {
    const apiKey = getApiKey();

    if (!apiKey) {
      showModal("Erreur", "Veuillez saisir votre token API", true);
      return;
    }

    console.log("Test de la clé API lancé");
    setButtonLoading(this, true, "Tester le token");

    try {
      const response = await fetch("/test_api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const data = await response.json();

      if (data.success) {
        showModal("Test réussi", `✅ ${data.message}`);
      } else {
        showModal(
          "Erreur de token API",
          `ProblÃ¨me avec le token API :\n\n${data.message}\n\nVérifiez votre token Grist`,
          true,
        );
      }
    } catch (error) {
      console.error("Erreur complÃ¨te:", error);
      showModal("Erreur de test", `Erreur de test: ${error.message}`, true);
    }

    setButtonLoading(this, false);
  });

  // Fonction pour nettoyer les résultats de test
  function clearTestResults() {
    const existingTestResults = document.querySelectorAll("[data-test-result]");
    existingTestResults.forEach((result) => result.remove());
  }

  // Activation du bouton de chargement quand un DOC_ID est saisi
  elements.docIdInput.addEventListener("input", function () {
    const hasValue = this.value.trim().length > 0;
    const hasApiKey = getApiKey().length > 0;
    elements.loadTablesBtn.disabled = !(hasValue && hasApiKey);

    // Reset des autres champs
    elements.tableSelect.innerHTML =
      '<option value="">-- Charger d\'abord les tables --</option>';
    elements.tableSelect.disabled = true;
    elements.columnSelect.innerHTML =
      '<option value="">-- Choisir d\'abord une table --</option>';
    elements.columnSelect.disabled = true;
    elements.generateBtn.disabled = true;
    elements.result.style.display = "none";
    clearTestResults();
    currentUrl = null;
  });

  // Activation du bouton de chargement quand l'API key est saisie
  elements.apiKeyInput.addEventListener("input", function () {
    const hasDocId = elements.docIdInput.value.trim().length > 0;
    const hasApiKey = this.value.trim().length > 0;
    elements.loadTablesBtn.disabled = !(hasDocId && hasApiKey);
  });

  // Chargement des tables
  elements.loadTablesBtn.addEventListener("click", async function () {
    const docId = elements.docIdInput.value.trim();
    const apiKey = getApiKey();

    if (!docId || !apiKey) {
      showModal(
        "Erreur",
        "Veuillez saisir un ID de document et un token API",
        true,
      );
      return;
    }

    setButtonLoading(this, true, "Charger les tables");

    try {
      const response = await fetch(`/api/tables/${docId}`, {
        headers: getHeaders(),
      });
      console.log("Réponse API:", response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const tables = await response.json();
      console.log("Tables reÃ§ues:", tables);

      if (tables && tables.length > 0) {
        elements.tableSelect.innerHTML =
          '<option value="">-- Choisir une table --</option>';
        tables.forEach((table) => {
          const option = document.createElement("option");
          option.value = table;
          option.textContent = table;
          elements.tableSelect.appendChild(option);
        });
        elements.tableSelect.disabled = false;

        // Afficher un message de succès temporaire
        const originalText = this.textContent;
        this.textContent = `✅ ${tables.length} tables chargées`;
        this.classList.add("fr-btn--success");

        setTimeout(() => {
          this.textContent = originalText;
          this.classList.remove("fr-btn--success");
        }, 2000);
      } else {
        elements.tableSelect.innerHTML =
          '<option value="">-- Aucune table trouvée --</option>';
        showModal(
          "Aucune table trouvée",
          "Aucune table trouvée.\n\nVérifiez l'ID du document et votre token API",
          true,
        );
      }
    } catch (error) {
      console.error("Erreur complÃ¨te:", error);
      showModal("Erreur de connexion", `Erreur: ${error.message}`, true);
    }

    setButtonLoading(this, false);
  });

  // Chargement des colonnes
  elements.tableSelect.addEventListener("change", async function () {
    const docId = elements.docIdInput.value.trim();
    const tableName = this.value;
    const apiKey = getApiKey();

    elements.columnSelect.innerHTML =
      '<option value="">-- Chargement... --</option>';
    elements.columnSelect.disabled = true;
    elements.generateBtn.disabled = true;
    elements.result.style.display = "none";
    clearTestResults();
    currentUrl = null;

    if (tableName && docId && apiKey) {
      try {
        const response = await fetch(`/api/columns/${docId}/${tableName}`, {
          headers: getHeaders(),
        });
        const columns = await response.json();

        elements.columnSelect.innerHTML =
          '<option value="">-- Choisir une colonne --</option>';
        columns.forEach((column) => {
          const option = document.createElement("option");
          option.value = column;
          option.textContent = column;
          elements.columnSelect.appendChild(option);
        });
        elements.columnSelect.disabled = false;

        // Stocker les colonnes pour le mode avancé
        availableColumns = columns;
      } catch (error) {
        elements.columnSelect.innerHTML =
          '<option value="">-- Erreur de chargement --</option>';
        console.error("Erreur:", error);
        showModal(
          "Erreur",
          `Erreur lors du chargement des colonnes: ${error.message}`,
          true,
        );
      }
    } else {
      elements.columnSelect.innerHTML =
        '<option value="">-- Choisir d\'abord une table --</option>';
    }
  });

  // Activation du bouton quand une colonne est sélectionnée
  elements.columnSelect.addEventListener("change", function () {
    elements.generateBtn.disabled = !this.value;
    advancedCheckbox.disabled = !this.value;
    elements.result.style.display = "none";
    clearTestResults();
    currentUrl = null;
  });

  // Fonction pour afficher les résultats de succÃ¨s
  function showSuccessResult(data) {
    const template = document.getElementById("result-success-template");
    const clone = template.content.cloneNode(true);

    // Remplir les données
    clone.getElementById("generated-url").textContent = data.url;
    clone.getElementById("doc-name").textContent =
      data.doc_name || "Nom non disponible";
    clone.getElementById("doc-id").textContent = data.doc_id;
    clone.getElementById("table-name").textContent = data.table;
    clone.getElementById("column-name").textContent = data.column;
    clone.getElementById("format-info").textContent = data.format_info;
    clone.getElementById("usage-info").textContent = data.usage;

    // Ajouter les gestionnaires d'événements
    const copyBtn = clone.getElementById("copyBtn");
    const testUrlBtn = clone.getElementById("testUrlBtn");

    copyBtn.addEventListener("click", () => copyToClipboard(data.url));
    testUrlBtn.addEventListener("click", () => testGeneratedUrl(data.url));

    // Afficher le résultat
    elements.result.innerHTML = "";
    elements.result.appendChild(clone);
    elements.result.style.display = "block";

    // Sauvegarder l'URL courante
    currentUrl = data.url;
  }

  // Fonction pour afficher les résultats d'erreur
  function showErrorResult(errorMessage) {
    const template = document.getElementById("result-error-template");
    const clone = template.content.cloneNode(true);

    clone.getElementById("error-message").textContent = errorMessage;

    elements.result.innerHTML = "";
    elements.result.appendChild(clone);
    elements.result.style.display = "block";
  }

  // Génération de l'URL
  elements.form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    elements.loading.style.display = "block";
    elements.result.style.display = "none";
    setButtonLoading(elements.generateBtn, true, "Générer l'URL");

    try {
      const response = await fetch("/generate_url", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("ðŸ” Données reÃ§ues du serveur:", data);

      if (response.ok) {
        showSuccessResult(data);
      } else {
        showErrorResult(data.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error("ðŸ”¥ Erreur lors de la génération:", error);
      showErrorResult(`Erreur de connexion: ${error.message}`);
    }

    elements.loading.style.display = "none";
    setButtonLoading(elements.generateBtn, false);
  });

  // Fonction pour copier dans le presse-papiers
  function copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showModal("Copié !", "URL copiée dans le presse-papiers !");
      })
      .catch((err) => {
        console.error("Erreur de copie:", err);
        // Fallback pour les navigateurs plus anciens
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        showModal("Copié !", "URL copiée dans le presse-papiers !");
      });
  }

  // Fonction pour tester l'URL générée
  async function testGeneratedUrl(url) {
    console.log("Test de l'URL:", url);

    // Remplacer {id} par une valeur de test
    const testId = prompt(
      "Entrez une valeur de test pour remplacer {id} et tester votre filtre principal:",
      "LPA",
    );
    if (!testId) return;

    console.log("Valeur de test:", testId);

    // Supprimer les résultats de test précédents
    const existingTestResults = document.querySelectorAll("[data-test-result]");
    existingTestResults.forEach((result) => result.remove());

    // Afficher le résultat de test
    await showTestResult(url, testId);
  }

  // Fonction pour afficher les résultats de test
  async function showTestResult(url, testId) {
    const template = document.getElementById("test-result-template");
    const clone = template.content.cloneNode(true);

    // Marquer comme résultat de test pour pouvoir le supprimer
    const testContainer = document.createElement("div");
    testContainer.setAttribute("data-test-result", "true");
    testContainer.appendChild(clone);

    // Ajouter aprÃ¨s le résultat principal
    elements.result.appendChild(testContainer);

    const rawResult = testContainer.querySelector("#raw-result");
    const accordionTitle = testContainer.querySelector("#accordion-title");
    const accordionBtn = testContainer.querySelector(".fr-accordion__btn");
    const accordionCollapse = testContainer.querySelector(".fr-collapse");

    // Afficher le chargement
    rawResult.textContent = "Chargement...";
    accordionTitle.textContent = "Chargement des résultats...";

    try {
      console.log("Appel Ã  /test_url avec:", { url, test_value: testId });

      // Appeler la route Flask pour tester l'URL
      const response = await fetch("/test_url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url,
          test_value: testId,
          api_key: getApiKey(),
        }),
      });

      const result = await response.json();
      console.log("Résultat du test:", result);

      if (result.success) {
        const data = result.data;
        const recordCount = data.records ? data.records.length : 0;

        // Afficher le JSON brut
        rawResult.textContent = JSON.stringify(data, null, 2);

        // Mettre Ã  jour le titre de l'accordéon
        accordionTitle.textContent = `Résultat JSON (${recordCount} enregistrement${
          recordCount > 1 ? "s" : ""
        } trouvé${recordCount > 1 ? "s" : ""})`;

        // Ouvrir l'accordéon automatiquement
        accordionBtn.setAttribute("aria-expanded", "true");
        accordionCollapse.classList.add("fr-collapse--expanded");
      } else {
        // Afficher l'erreur
        rawResult.textContent = `Erreur: ${result.error}`;
        accordionTitle.textContent = `Erreur lors du test`;

        // Ouvrir l'accordéon pour montrer l'erreur
        accordionBtn.setAttribute("aria-expanded", "true");
        accordionCollapse.classList.add("fr-collapse--expanded");
      }
    } catch (error) {
      console.error("Erreur lors du test:", error);
      rawResult.textContent = `Erreur: ${error.message}`;
      accordionTitle.textContent = `Erreur de connexion`;

      // Ouvrir l'accordéon pour montrer l'erreur
      accordionBtn.setAttribute("aria-expanded", "true");
      accordionCollapse.classList.add("fr-collapse--expanded");
    }

    // Réinitialiser le JavaScript DSFR pour les nouveaux composants
    // Ou utiliser un fallback si DSFR ne fonctionne pas
    setTimeout(() => {
      if (typeof window.dsfr !== "undefined" && window.dsfr.accordions) {
        window.dsfr.accordions.init();
      } else {
        // Fallback : ajouter un gestionnaire d'événements manuel
        initAccordionFallback(testContainer);
      }
    }, 100);
  }

  // Fonction fallback pour l'accordéon si DSFR ne fonctionne pas
  function initAccordionFallback(container) {
    const accordionBtn = container.querySelector(".fr-accordion__btn");
    const accordionCollapse = container.querySelector(".fr-collapse");

    if (accordionBtn && accordionCollapse) {
      // Supprimer les anciens gestionnaires d'événements
      accordionBtn.replaceWith(accordionBtn.cloneNode(true));
      const newAccordionBtn = container.querySelector(".fr-accordion__btn");

      newAccordionBtn.addEventListener("click", function (e) {
        e.preventDefault();
        const isExpanded = this.getAttribute("aria-expanded") === "true";

        if (isExpanded) {
          this.setAttribute("aria-expanded", "false");
          accordionCollapse.classList.remove("fr-collapse--expanded");
        } else {
          this.setAttribute("aria-expanded", "true");
          accordionCollapse.classList.add("fr-collapse--expanded");
        }
      });

      console.log("Accordéon fallback initialisé");
    }
  }

  // Fonction pour initialiser les onglets DSFR
  function initTabs(container) {
    const tabs = container.querySelectorAll(".fr-tabs__tab");
    const panels = container.querySelectorAll(".fr-tabs__panel");

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        // Désactiver tous les onglets
        tabs.forEach((t) => {
          t.setAttribute("aria-selected", "false");
          t.setAttribute("tabindex", "-1");
        });

        // Cacher tous les panneaux
        panels.forEach((p) => {
          p.classList.remove("fr-tabs__panel--selected");
        });

        // Activer l'onglet cliqué
        tab.setAttribute("aria-selected", "true");
        tab.setAttribute("tabindex", "0");

        // Afficher le panneau correspondant
        const targetPanel = container.querySelector(
          "#" + tab.getAttribute("aria-controls"),
        );
        if (targetPanel) {
          targetPanel.classList.add("fr-tabs__panel--selected");
        }
      });
    });
  }

  // ============================================
  // MODE AVANCÉ - Toggle simple
  // ============================================

  const advancedCheckbox = document.getElementById("advancedMode");
  const simpleMode = document.getElementById("simpleMode");
  const advancedSection = document.getElementById("advancedSection");
  const addFilterBtn = document.getElementById("addFilterBtn");
  const generateAdvancedBtn = document.getElementById("generateAdvancedBtn");
  const filtersContainer = document.getElementById("filters-container");

  let filterCount = 0;
  let availableColumns = [];

  // Réinitialiser la checkbox au chargement
  advancedCheckbox.checked = false;
  advancedSection.style.display = "none";

  // Toggle entre mode simple et avancé
  advancedCheckbox.addEventListener("change", function () {
    if (this.checked) {
      simpleMode.style.display = "none";
      advancedSection.style.display = "block";

      // Créer automatiquement le 1er filtre avec la colonne sélectionnée
      const selectedColumn = elements.columnSelect.value;
      if (selectedColumn && filtersContainer.children.length === 0) {
        addFirstFilter(selectedColumn);
      }

      if (elements.tableSelect.value) {
        addFilterBtn.disabled = false;
      }
    } else {
      simpleMode.style.display = "block";
      advancedSection.style.display = "none";
    }
  });

  // Fonction pour ajouter le 1er filtre automatiquement
  function addFirstFilter(columnName) {
    filterCount++;
    const filterId = "filter-" + filterCount;

    const filterHTML = `
      <h6 class="fr-text--sm fr-mb-1w" style="color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Filtre principal</h6>
      <div class="fr-card fr-card--sm fr-mb-3w" id="${filterId}" data-filter-id="${filterCount}" style="border-left: 4px solid #000091; background: #f5f5fe;">
        <div class="fr-card__body">
          <div class="fr-card__content">
            <p class="fr-text--sm fr-mb-0">
              <strong>${columnName}</strong>
              <span class="fr-badge fr-badge--sm fr-badge--blue-france fr-ml-1w">{id}</span>
            </p>
          </div>
        </div>
      </div>
      <h6 class="fr-text--sm fr-mb-1w" style="color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Filtres additionnels</h6>
    `;

    filtersContainer.insertAdjacentHTML("beforeend", filterHTML);
    window.mainFilterColumn = columnName;
    updateGenerateButton();
  }

  // Activer le bouton "Ajouter un filtre"
  elements.tableSelect.addEventListener("change", function () {
    if (this.value && advancedCheckbox.checked) {
      addFilterBtn.disabled = false;
    }
  });

  // Ajouter un filtre supplémentaire
  addFilterBtn.addEventListener("click", function () {
    filterCount++;
    const filterId = "filter-" + filterCount;

    const filterHTML = `
      <div class="fr-card fr-card--sm fr-mb-2w" id="${filterId}" data-filter-id="${filterCount}">
        <div class="fr-card__body">
          <div class="fr-card__content">
            <div class="fr-grid-row fr-grid-row--gutters">
              <div class="fr-col-12 fr-col-md-4">
                <div class="fr-select-group">
                  <label class="fr-label" for="${filterId}-column">Colonne</label>
                  <select class="fr-select filter-column" id="${filterId}-column" required>
                    <option value="">-- Choisir --</option>
                  </select>
                </div>
              </div>
              <div class="fr-col-12 fr-col-md-3">
                <div class="fr-input-group">
                  <label class="fr-label">Type</label>
                  <div class="fr-radio-group">
                    <input type="radio" id="${filterId}-dynamic" name="${filterId}-type" value="dynamic" checked>
                    <label class="fr-label" for="${filterId}-dynamic">{id}</label>
                  </div>
                  <div class="fr-radio-group">
                    <input type="radio" id="${filterId}-fixed" name="${filterId}-type" value="fixed">
                    <label class="fr-label" for="${filterId}-fixed">Fixes</label>
                  </div>
                </div>
              </div>
              <div class="fr-col-12 fr-col-md-4">
                <div class="fr-input-group" id="${filterId}-values-group" style="display: none;">
                  <label class="fr-label" for="${filterId}-values">Valeurs (virgules)</label>
                  <input class="fr-input filter-values" type="text" id="${filterId}-values" placeholder="LPA, LEGTA">
                </div>
              </div>
              <div class="fr-col-12 fr-col-md-1">
                <button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-delete-bin-line"
                        onclick="removeFilter('${filterId}')" title="Supprimer">
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    filtersContainer.insertAdjacentHTML("beforeend", filterHTML);

    const columnSelect = document.getElementById(filterId + "-column");
    availableColumns.forEach((col) => {
      const option = document.createElement("option");
      option.value = col;
      option.textContent = col;
      columnSelect.appendChild(option);
    });

    const radioFixed = document.getElementById(filterId + "-fixed");
    const radioDynamic = document.getElementById(filterId + "-dynamic");
    const valuesGroup = document.getElementById(filterId + "-values-group");

    radioFixed.addEventListener("change", function () {
      if (this.checked) valuesGroup.style.display = "block";
    });

    radioDynamic.addEventListener("change", function () {
      if (this.checked) valuesGroup.style.display = "none";
    });

    updateGenerateButton();
  });

  window.removeFilter = function (filterId) {
    const filterElement = document.getElementById(filterId);
    if (filterElement) {
      filterElement.remove();
      updateGenerateButton();
    }
  };

  function updateGenerateButton() {
    const filters = filtersContainer.querySelectorAll("[data-filter-id]");
    generateAdvancedBtn.disabled = filters.length === 0;
  }

  generateAdvancedBtn.addEventListener("click", async function () {
    const filters = [];

    // Ajouter la colonne principale en 1er
    filters.push({
      column: window.mainFilterColumn || elements.columnSelect.value,
      type: "dynamic",
    });

    // Puis ajouter les autres filtres
    const filterElements =
      filtersContainer.querySelectorAll("[data-filter-id]");

    filterElements.forEach((filterEl) => {
      // Skip le 1er filtre (déjà ajouté)
      if (filterEl.id === "filter-1") return;

      const filterId = filterEl.id;
      const column = document.getElementById(filterId + "-column").value;
      const type = document.querySelector(
        `input[name="${filterId}-type"]:checked`,
      ).value;

      if (!column) return;

      const filter = { column: column, type: type };

      if (type === "fixed") {
        const valuesInput = document.getElementById(filterId + "-values").value;
        filter.values = valuesInput
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v);
      }

      filters.push(filter);
    });

    if (filters.length === 0) {
      showModal("Erreur", "Configurez au moins un filtre");
      return;
    }

    const requestData = {
      doc_id: elements.docIdInput.value.trim(),
      table_name: elements.tableSelect.value,
      filters: filters,
      api_key: getApiKey(),
    };

    elements.loading.style.display = "block";
    elements.result.style.display = "none";
    this.disabled = true;
    this.textContent = "Génération...";

    try {
      const response = await fetch("/generate_url_advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        showSuccessResult(data);
      } else {
        showErrorResult(data.error || "Erreur inconnue");
      }
    } catch (error) {
      showErrorResult("Erreur: " + error.message);
    }

    elements.loading.style.display = "none";
    this.disabled = false;
    this.textContent = "Générer l'URL avancée";
  });

  // Bouton Recommencer
  const resetBtn = document.getElementById("resetBtn");
  const resetSection = document.getElementById("resetSection");

  resetBtn.addEventListener("click", function () {
    // Réinitialiser tous les champs
    elements.apiKeyInput.value = "";
    elements.docIdInput.value = "";
    elements.tableSelect.innerHTML =
      '<option value="">-- Charger d\'abord les tables --</option>';
    elements.tableSelect.disabled = true;
    elements.columnSelect.innerHTML =
      '<option value="">-- Choisir d\'abord une table --</option>';
    elements.columnSelect.disabled = true;
    elements.generateBtn.disabled = true;
    elements.loadTablesBtn.disabled = true;

    // Réinitialiser mode avancé
    advancedCheckbox.checked = false;
    advancedCheckbox.disabled = true;
    simpleMode.style.display = "block";
    advancedSection.style.display = "none";
    filtersContainer.innerHTML = "";
    filterCount = 0;
    availableColumns = [];
    addFilterBtn.disabled = true;
    generateAdvancedBtn.disabled = true;

    // Cacher résultats et bouton recommencer
    elements.result.style.display = "none";
    resetSection.style.display = "none";

    // Scroll en haut
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Afficher le bouton Recommencer quand une URL est générée
  const originalShowSuccess = showSuccessResult;
  showSuccessResult = function (data) {
    originalShowSuccess(data);
    resetSection.style.display = "block";
  };

  console.log("🚀 Application initialisée");
});
