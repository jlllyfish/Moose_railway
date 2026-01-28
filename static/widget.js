// Widget Moose pour Grist - JavaScript
document.addEventListener("DOMContentLoaded", function () {
  console.log("Widget Moose charge");

  const elements = {
    apiKeyInput: document.getElementById("api_key"),
    docIdInput: document.getElementById("doc_id"),
    testApiBtn: document.getElementById("testApiBtn"),
    loadTablesBtn: document.getElementById("loadTablesBtn"),
    tableSelect: document.getElementById("table_name"),
    columnSelect: document.getElementById("column_name"),
    generateBtn: document.getElementById("generateBtn"),
    loading: document.getElementById("loading"),
    result: document.getElementById("result"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modal-title"),
    modalText: document.getElementById("modal-text"),
  };

  // Helper pour recuperer l'API key
  const getApiKey = () => elements.apiKeyInput.value.trim();

  // Helper pour creer les headers
  const getHeaders = () => {
    const apiKey = getApiKey();
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  };

  // Modale
  function showModal(title, message) {
    elements.modalTitle.textContent = title;
    elements.modalText.textContent = message;
    elements.modal.setAttribute("aria-hidden", "false");
    elements.modal.classList.add("fr-modal--opened");
  }

  function hideModal() {
    elements.modal.setAttribute("aria-hidden", "true");
    elements.modal.classList.remove("fr-modal--opened");
  }

  elements.modal.querySelectorAll(".fr-btn--close").forEach((btn) => {
    btn.addEventListener("click", hideModal);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && elements.modal.classList.contains("fr-modal--opened")) {
      hideModal();
    }
  });

  // Verification des champs
  function checkFields() {
    const hasApiKey = getApiKey().length > 0;
    const hasDocId = elements.docIdInput.value.trim().length > 0;
    elements.loadTablesBtn.disabled = !(hasApiKey && hasDocId);
  }

  elements.apiKeyInput.addEventListener("input", checkFields);
  elements.docIdInput.addEventListener("input", checkFields);

  // Test API
  elements.testApiBtn.addEventListener("click", async function () {
    const apiKey = getApiKey();
    if (!apiKey) {
      showModal("Erreur", "Veuillez saisir votre token API");
      return;
    }

    this.disabled = true;
    this.textContent = "Test en cours...";

    try {
      const response = await fetch("/test_api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const data = await response.json();
      showModal(data.success ? "Test reussi" : "Erreur", data.message);
    } catch (error) {
      showModal("Erreur", "Erreur: " + error.message);
    }

    this.disabled = false;
    this.textContent = "Tester le token";
  });

  // Chargement des tables
  elements.loadTablesBtn.addEventListener("click", async function () {
    const docId = elements.docIdInput.value.trim();
    const apiKey = getApiKey();

    if (!docId || !apiKey) {
      showModal("Erreur", "Token et Doc ID requis");
      return;
    }

    this.disabled = true;
    this.textContent = "Chargement...";

    try {
      const response = await fetch(`/api/tables/${docId}`, {
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Erreur " + response.status);

      const tables = await response.json();

      if (tables && tables.length > 0) {
        elements.tableSelect.innerHTML = '<option value="">-- Choisir une table --</option>';
        tables.forEach((table) => {
          const option = document.createElement("option");
          option.value = table;
          option.textContent = table;
          elements.tableSelect.appendChild(option);
        });
        elements.tableSelect.disabled = false;
        this.textContent = tables.length + " tables chargees";
        setTimeout(() => {
          this.textContent = "Charger les tables";
        }, 2000);
      } else {
        showModal("Erreur", "Aucune table trouvee");
      }
    } catch (error) {
      showModal("Erreur", "Erreur: " + error.message);
    }

    this.disabled = false;
  });

  // Chargement des colonnes
  elements.tableSelect.addEventListener("change", async function () {
    const docId = elements.docIdInput.value.trim();
    const tableName = this.value;
    const apiKey = getApiKey();

    elements.columnSelect.innerHTML = '<option value="">-- Chargement... --</option>';
    elements.columnSelect.disabled = true;
    elements.generateBtn.disabled = true;
    elements.result.style.display = "none";

    if (tableName && docId && apiKey) {
      try {
        const response = await fetch(`/api/columns/${docId}/${tableName}`, {
          headers: getHeaders(),
        });
        const columns = await response.json();

        elements.columnSelect.innerHTML = '<option value="">-- Choisir une colonne --</option>';
        columns.forEach((column) => {
          const option = document.createElement("option");
          option.value = column;
          option.textContent = column;
          elements.columnSelect.appendChild(option);
        });
        elements.columnSelect.disabled = false;
      } catch (error) {
        showModal("Erreur", "Erreur colonnes: " + error.message);
      }
    }
  });

  // Activation bouton generer
  elements.columnSelect.addEventListener("change", function () {
    elements.generateBtn.disabled = !this.value;
  });

  // Generation URL
  elements.generateBtn.addEventListener("click", async function () {
    console.log("Clic sur generer");
    
    const formData = new FormData();
    formData.append("api_key", getApiKey());
    formData.append("doc_id", elements.docIdInput.value);
    formData.append("table_name", elements.tableSelect.value);
    formData.append("column_name", elements.columnSelect.value);

    elements.loading.style.display = "block";
    elements.result.style.display = "none";
    this.disabled = true;

    try {
      const response = await fetch("/generate_url", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("Reponse:", data);

      if (response.ok && data.url) {
        const template = document.getElementById("result-success-template");
        const clone = template.content.cloneNode(true);

        clone.getElementById("generated-url").textContent = data.url;
        clone.getElementById("doc-name").textContent = data.doc_name || "Document";
        clone.getElementById("table-name").textContent = data.table;
        clone.getElementById("column-name").textContent = data.column;

        // Bouton copier
        clone.getElementById("copyBtn").addEventListener("click", () => {
          navigator.clipboard
            .writeText(data.url)
            .then(() => showModal("Copie", "URL copiee !"))
            .catch(() => showModal("Erreur", "Erreur de copie"));
        });

        // Bouton tester
        clone.getElementById("testUrlBtn").addEventListener("click", () => {
          const testId = prompt("Valeur de test pour {id}:", "test");
          if (testId) testGeneratedUrl(data.url, testId);
        });

        elements.result.innerHTML = "";
        elements.result.appendChild(clone);
        elements.result.style.display = "block";
      } else {
        const template = document.getElementById("result-error-template");
        const clone = template.content.cloneNode(true);
        clone.getElementById("error-message").textContent = data.error || "Erreur";
        elements.result.innerHTML = "";
        elements.result.appendChild(clone);
        elements.result.style.display = "block";
      }
    } catch (error) {
      console.error("Erreur:", error);
      showModal("Erreur", "Erreur generation: " + error.message);
    }

    elements.loading.style.display = "none";
    this.disabled = false;
  });

  // Test URL
  async function testGeneratedUrl(url, testValue) {
    const apiKey = getApiKey();

    try {
      const response = await fetch("/test_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          test_value: testValue,
          api_key: apiKey,
        }),
      });

      const data = await response.json();
      const template = document.getElementById("test-result-template");
      const clone = template.content.cloneNode(true);

      if (data.success) {
        const recordCount = data.data.records ? data.data.records.length : 0;
        clone.getElementById("raw-result").textContent = JSON.stringify(data.data, null, 2);
        clone.getElementById("accordion-title").textContent =
          "Resultat JSON (" + recordCount + " enregistrement" + (recordCount > 1 ? "s" : "") + ")";
      } else {
        clone.getElementById("raw-result").textContent = "Erreur: " + data.error;
        clone.getElementById("accordion-title").textContent = "Erreur test";
      }

      const testContainer = document.createElement("div");
      testContainer.setAttribute("data-test-result", "true");
      testContainer.appendChild(clone);
      elements.result.appendChild(testContainer);
    } catch (error) {
      showModal("Erreur", "Erreur test: " + error.message);
    }
  }

  console.log("Widget pret");
});
