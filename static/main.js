// Generateur d'URL Grist - JavaScript principal
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

  // Helper pour recuperer l'API key
  const getApiKey = () => elements.apiKeyInput.value.trim();

  // Helper pour creer les headers avec l'API key
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

  // Test de la cle API
  elements.testApiBtn.addEventListener("click", async function () {
    const apiKey = getApiKey();

    if (!apiKey) {
      showModal("Erreur", "Veuillez saisir votre token API", true);
      return;
    }

    console.log("Test de la cle API lance");
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
        showModal("Test reussi", data.message);
      } else {
        showModal(
          "Erreur de token API",
          "Probleme avec le token API. Verifiez votre token Grist.",
          true
        );
      }
    } catch (error) {
      console.error("Erreur complete:", error);
      showModal("Erreur de test", "Erreur de test: " + error.message, true);
    }

    setButtonLoading(this, false);
  });

  // Fonction pour nettoyer les resultats de test
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
        true
      );
      return;
    }

    setButtonLoading(this, true, "Charger les tables");

    try {
      const response = await fetch(`/api/tables/${docId}`, {
        headers: getHeaders(),
      });
      console.log("Reponse API:", response.status, response.statusText);

      if (!response.ok) {
        throw new Error("Erreur " + response.status + ": " + response.statusText);
      }

      const tables = await response.json();
      console.log("Tables recues:", tables);

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

        // Afficher un message de succes temporaire
        const originalText = this.textContent;
        this.textContent = tables.length + " tables chargees";
        this.classList.add("fr-btn--success");

        setTimeout(() => {
          this.textContent = originalText;
          this.classList.remove("fr-btn--success");
        }, 2000);
      } else {
        elements.tableSelect.innerHTML =
          '<option value="">-- Aucune table trouvee --</option>';
        showModal(
          "Aucune table trouvee",
          "Aucune table trouvee. Verifiez l'ID du document et votre token API",
          true
        );
      }
    } catch (error) {
      console.error("Erreur complete:", error);
      showModal("Erreur de connexion", "Erreur: " + error.message, true);
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
      } catch (error) {
        elements.columnSelect.innerHTML =
          '<option value="">-- Erreur de chargement --</option>';
        console.error("Erreur:", error);
        showModal(
          "Erreur",
          "Erreur lors du chargement des colonnes: " + error.message,
          true
        );
      }
    } else {
      elements.columnSelect.innerHTML =
        '<option value="">-- Choisir d\'abord une table --</option>';
    }
  });

  // Activation du bouton quand une colonne est selectionnee
  elements.columnSelect.addEventListener("change", function () {
    elements.generateBtn.disabled = !this.value;
    elements.result.style.display = "none";
    clearTestResults();
    currentUrl = null;
  });

  // Fonction pour afficher les resultats de succes
  function showSuccessResult(data) {
    const template = document.getElementById("result-success-template");
    const clone = template.content.cloneNode(true);

    // Remplir les donnees
    clone.getElementById("generated-url").textContent = data.url;
    clone.getElementById("doc-name").textContent =
      data.doc_name || "Nom non disponible";
    clone.getElementById("doc-id").textContent = data.doc_id;
    clone.getElementById("table-name").textContent = data.table;
    clone.getElementById("column-name").textContent = data.column;
    clone.getElementById("format-info").textContent = data.format_info;
    clone.getElementById("usage-info").textContent = data.usage;

    // Ajouter les gestionnaires d'evenements
    const copyBtn = clone.getElementById("copyBtn");
    const testUrlBtn = clone.getElementById("testUrlBtn");

    copyBtn.addEventListener("click", () => copyToClipboard(data.url));
    testUrlBtn.addEventListener("click", () => testGeneratedUrl(data.url));

    // Afficher le resultat
    elements.result.innerHTML = "";
    elements.result.appendChild(clone);
    elements.result.style.display = "block";

    // Sauvegarder l'URL courante
    currentUrl = data.url;
  }

  // Fonction pour afficher les resultats d'erreur
  function showErrorResult(errorMessage) {
    const template = document.getElementById("result-error-template");
    const clone = template.content.cloneNode(true);

    clone.getElementById("error-message").textContent = errorMessage;

    elements.result.innerHTML = "";
    elements.result.appendChild(clone);
    elements.result.style.display = "block";
  }

  // Generation de l'URL
  elements.form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    elements.loading.style.display = "block";
    elements.result.style.display = "none";
    setButtonLoading(elements.generateBtn, true, "Generer l'URL");

    try {
      const response = await fetch("/generate_url", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("Donnees recues du serveur:", data);

      if (response.ok) {
        showSuccessResult(data);
      } else {
        showErrorResult(data.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error("Erreur lors de la generation:", error);
      showErrorResult("Erreur de connexion: " + error.message);
    }

    elements.loading.style.display = "none";
    setButtonLoading(elements.generateBtn, false);
  });

  // Fonction pour copier dans le presse-papiers
  function copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showModal("Copie !", "URL copiee dans le presse-papiers !");
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
        showModal("Copie !", "URL copiee dans le presse-papiers !");
      });
  }

  // Fonction pour tester l'URL generee
  async function testGeneratedUrl(url) {
    console.log("Test de l'URL:", url);

    // Remplacer {id} par une valeur de test
    const testId = prompt(
      "Entrez une valeur de test pour remplacer {id}:",
      "LPA"
    );
    if (!testId) return;

    console.log("Valeur de test:", testId);

    // Supprimer les resultats de test precedents
    const existingTestResults = document.querySelectorAll("[data-test-result]");
    existingTestResults.forEach((result) => result.remove());

    // Afficher le resultat de test
    await showTestResult(url, testId);
  }

  // Fonction pour afficher les resultats de test
  async function showTestResult(url, testId) {
    const template = document.getElementById("test-result-template");
    const clone = template.content.cloneNode(true);

    // Marquer comme resultat de test pour pouvoir le supprimer
    const testContainer = document.createElement("div");
    testContainer.setAttribute("data-test-result", "true");
    testContainer.appendChild(clone);

    // Ajouter apres le resultat principal
    elements.result.appendChild(testContainer);

    const rawResult = testContainer.querySelector("#raw-result");
    const accordionTitle = testContainer.querySelector("#accordion-title");
    const accordionBtn = testContainer.querySelector(".fr-accordion__btn");
    const accordionCollapse = testContainer.querySelector(".fr-collapse");

    // Afficher le chargement
    rawResult.textContent = "Chargement...";
    accordionTitle.textContent = "Chargement des resultats...";

    try {
      console.log("Appel a /test_url avec:", { url, test_value: testId });

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
      console.log("Resultat du test:", result);

      if (result.success) {
        const data = result.data;
        const recordCount = data.records ? data.records.length : 0;

        // Afficher le JSON brut
        rawResult.textContent = JSON.stringify(data, null, 2);

        // Mettre a jour le titre de l'accordeon
        accordionTitle.textContent = "Resultat JSON (" + recordCount + " enregistrement" +
          (recordCount > 1 ? "s" : "") + " trouve" + (recordCount > 1 ? "s" : "") + ")";

        // Ouvrir l'accordeon automatiquement
        accordionBtn.setAttribute("aria-expanded", "true");
        accordionCollapse.classList.add("fr-collapse--expanded");
      } else {
        // Afficher l'erreur
        rawResult.textContent = "Erreur: " + result.error;
        accordionTitle.textContent = "Erreur lors du test";

        // Ouvrir l'accordeon pour montrer l'erreur
        accordionBtn.setAttribute("aria-expanded", "true");
        accordionCollapse.classList.add("fr-collapse--expanded");
      }
    } catch (error) {
      console.error("Erreur lors du test:", error);
      rawResult.textContent = "Erreur: " + error.message;
      accordionTitle.textContent = "Erreur de connexion";

      // Ouvrir l'accordeon pour montrer l'erreur
      accordionBtn.setAttribute("aria-expanded", "true");
      accordionCollapse.classList.add("fr-collapse--expanded");
    }

    // Reinitialiser le JavaScript DSFR pour les nouveaux composants
    // Ou utiliser un fallback si DSFR ne fonctionne pas
    setTimeout(() => {
      if (typeof window.dsfr !== "undefined" && window.dsfr.accordions) {
        window.dsfr.accordions.init();
      } else {
        // Fallback : ajouter un gestionnaire d'evenements manuel
        initAccordionFallback(testContainer);
      }
    }, 100);
  }

  // Fonction fallback pour l'accordeon si DSFR ne fonctionne pas
  function initAccordionFallback(container) {
    const accordionBtn = container.querySelector(".fr-accordion__btn");
    const accordionCollapse = container.querySelector(".fr-collapse");

    if (accordionBtn && accordionCollapse) {
      // Supprimer les anciens gestionnaires d'evenements
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

      console.log("Accordeon fallback initialise");
    }
  }

  // Initialisation
  console.log("Application initialisee");
});
