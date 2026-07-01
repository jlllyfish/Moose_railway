import json
import os
import re
import urllib.parse

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

# Chargement des variables d'environnement
load_dotenv()

app = Flask(__name__)

# Fait confiance aux en-têtes X-Forwarded-* du proxy Railway (1 seul saut de
# proxy) pour que request.remote_addr et request.is_secure reflètent le
# vrai client, et non le proxy interne. Sans ça, le rate limiting devient
# global (toutes les requêtes semblent venir de la même IP) et le header
# HSTS n'est jamais envoyé.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# Configuration de sécurité
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(24))
app.config["SESSION_COOKIE_SECURE"] = True  # HTTPS only
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

# Configuration
GRIST_BASE_URL = "https://grist.numerique.gouv.fr"
API_KEY = os.getenv("GRIST_API_KEY", "")


class GristAPIClient:
    def __init__(self, base_url, api_key=None):
        self.base_url = base_url
        self.api_key = api_key

    def get_headers(self, api_key=None):
        """Génère les headers avec la clé API"""
        key = api_key or self.api_key
        if not key:
            raise ValueError("API key required")
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def get_document_info(self, doc_id, api_key=None):
        """Récupère les informations du document"""
        url = f"{self.base_url}/api/docs/{doc_id}"
        try:
            print("📄 Récupération infos document")
            response = requests.get(url, headers=self.get_headers(api_key))
            print(f"📊 Statut réponse: {response.status_code}")

            if response.status_code != 200:
                print(f"❌ Erreur HTTP: {response.text}")
                return "Document sans nom"

            data = response.json()

            # Essayer différents champs pour le nom
            doc_name = (
                data.get("name")
                or data.get("title")
                or data.get("docName")
                or "Document sans nom"
            )
            print(f"✅ Nom du document trouvé: {doc_name}")
            return doc_name

        except Exception as e:
            print(f"❌ Erreur lors de la récupération du nom du document: {e}")
            return "Document sans nom"

    def get_tables(self, doc_id, api_key=None):
        """Récupère la liste des tables du document (filtrée)"""
        url = f"{self.base_url}/api/docs/{doc_id}/tables"
        try:
            response = requests.get(url, headers=self.get_headers(api_key))
            response.raise_for_status()
            data = response.json()

            # Filtrer les tables système et de démonstration
            excluded_tables = [
                "GristDocTour",
                "GristHidden_import",
                "_grist_Tables",
                "_grist_Tables_column",
                "_grist_Views",
                "_grist_Views_section",
                "_grist_Views_section_field",
                "_grist_TabBar",
                "_grist_Pages",
                "_grist_Attachments",
                "_grist_Cells",
                "_grist_ACLResources",
                "_grist_ACLRules",
                "_grist_ACLMemberships",
            ]

            all_tables = [table["id"] for table in data.get("tables", [])]

            # Filtrer les tables qui commencent par _ ou qui sont dans la liste d'exclusion
            filtered_tables = [
                table
                for table in all_tables
                if not table.startswith("_grist_") and table not in excluded_tables
            ]

            print(
                f"📋 Tables trouvées: {len(all_tables)} (total), {len(filtered_tables)} (filtrées)"
            )
            print(f"📋 Tables affichées: {filtered_tables}")

            return filtered_tables

        except Exception as e:
            print(f"❌ Erreur lors de la récupération des tables: {e}")
            return []

    def get_columns(self, doc_id, table_name, api_key=None):
        """Récupère les colonnes d'une table spécifique"""
        url = f"{self.base_url}/api/docs/{doc_id}/tables/{table_name}/columns"
        try:
            response = requests.get(url, headers=self.get_headers(api_key))
            response.raise_for_status()
            data = response.json()
            columns = [col["id"] for col in data.get("columns", [])]
            print(f"📊 Colonnes trouvées pour {table_name}: {len(columns)} colonnes")
            return columns
        except Exception as e:
            print(f"❌ Erreur lors de la récupération des colonnes: {e}")
            return []

    def generate_filter_url(self, doc_id, table_name, column_name):
        """Génère l'URL avec filtre pour Grist - utilise {id} comme placeholder"""
        # Construction du filtre JSON avec le placeholder final
        filter_json = '{"' + column_name + '":["PLACEHOLDER_ID"]}'

        # Encoder le filtre complet
        filter_encoded = urllib.parse.quote(filter_json)

        # Remplacer le placeholder par {id} NON encodé pour qu'il reste littéral
        filter_encoded = filter_encoded.replace("PLACEHOLDER_ID", "{id}")

        url = f"{self.base_url}/api/docs/{doc_id}/tables/{table_name}/records?filter={filter_encoded}"
        print("🔗 URL générée")
        print(f"📋 Filtre décodé: {urllib.parse.unquote(filter_encoded)}")
        return url

    def generate_filter_url_advanced(self, doc_id, table_name, filters):
        """
        Génère une URL avec plusieurs filtres
        filters = [
            {'column': 'EDE8', 'type': 'dynamic', 'value': '{id}'},
            {'column': 'Région', 'type': 'fixed', 'values': ['Occitanie']},
            {'column': 'Nature', 'type': 'fixed', 'values': ['LPA', 'LEGTA']}
        ]
        """
        filter_dict = {}

        for f in filters:
            col = f["column"]
            if f["type"] == "dynamic":
                # Placeholder temporaire pour éviter l'encodage
                filter_dict[col] = ["PLACEHOLDER_ID"]
            else:
                # Valeurs fixes
                filter_dict[col] = f.get("values", [])

        # Convertir en JSON puis encoder
        filter_json = json.dumps(filter_dict)
        filter_encoded = urllib.parse.quote(filter_json)

        # Remplacer le placeholder par {id} NON encodé
        filter_encoded = filter_encoded.replace("PLACEHOLDER_ID", "{id}")

        url = f"{self.base_url}/api/docs/{doc_id}/tables/{table_name}/records?filter={filter_encoded}"
        print("🔗 URL avancée générée")
        print(f"📋 Filtre décodé: {urllib.parse.unquote(filter_encoded)}")
        return url

    def generate_sql_url(
        self, doc_id, table_name, conditions, connector="AND", order_by=None, limit=20
    ):
        """
        Génère une URL utilisant l'endpoint /sql de Grist.
        conditions = [
            {'column': 'usager_email', 'operator': 'contains', 'type': 'dynamic'},
            {'column': 'state', 'operator': 'exact', 'type': 'fixed', 'value': 'accepte'},
            {'column': 'Nature', 'operator': 'in', 'type': 'fixed', 'values': ['LPA', 'LEGTA']}
        ]
        order_by = {'column': 'usager_email', 'direction': 'ASC'}  # optionnel

        Chaque condition dynamique reçoit un placeholder unique : la première
        utilise {id} (compatibilité avec le filtre principal), les suivantes
        {id2}, {id3}, etc. Cela permet à DN d'insérer une balise différente
        pour chaque placeholder.
        """

        def validate_column(col):
            if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", col):
                raise ValueError(f"Nom de colonne invalide : {col}")
            return col

        def escape_sql_string(value):
            # Échappement standard SQL : une apostrophe devient deux apostrophes
            return str(value).replace("'", "''")

        # Validation du nom de table (défense en profondeur : ne pas se fier
        # au fait que le frontend n'envoie que des valeurs issues du dropdown)
        table_name = validate_column(table_name)

        where_clauses = []
        dynamic_count = 0

        for cond in conditions:
            col = validate_column(cond["column"])
            operator = cond["operator"]
            is_dynamic = cond.get("type") == "dynamic"

            if is_dynamic:
                dynamic_count += 1
                placeholder = "{id}" if dynamic_count == 1 else f"{{id{dynamic_count}}}"

            if operator == "exact":
                value = (
                    f"'{placeholder}'"
                    if is_dynamic
                    else f"'{escape_sql_string(cond['value'])}'"
                )
                where_clauses.append(f"{col} = {value}")

            elif operator == "contains":
                value = placeholder if is_dynamic else escape_sql_string(cond["value"])
                where_clauses.append(f"lower({col}) LIKE lower('%{value}%')")

            elif operator == "startswith":
                value = placeholder if is_dynamic else escape_sql_string(cond["value"])
                where_clauses.append(f"lower({col}) LIKE lower('{value}%')")

            elif operator == "in":
                if is_dynamic:
                    # IN dynamique peu utile en pratique mais géré pour cohérence
                    where_clauses.append(f"{col} = '{placeholder}'")
                else:
                    values = cond.get("values", [])
                    escaped = ", ".join(f"'{escape_sql_string(v)}'" for v in values)
                    where_clauses.append(f"{col} IN ({escaped})")
            else:
                raise ValueError(f"Opérateur inconnu : {operator}")

        where_sql = f" {connector} ".join(where_clauses) if where_clauses else "1=1"

        sql = f"SELECT * FROM {table_name} WHERE {where_sql}"

        if order_by and order_by.get("column"):
            order_col = validate_column(order_by["column"])
            direction = "DESC" if order_by.get("direction") == "DESC" else "ASC"
            sql += f" ORDER BY {order_col} {direction}"

        sql += f" LIMIT {int(limit)}"

        # Encoder, puis dé-encoder tous les placeholders {id}, {id2}, {id3}...
        sql_encoded = urllib.parse.quote(sql)
        sql_encoded = re.sub(r"%7B(id\d*)%7D", r"{\1}", sql_encoded)

        url = f"{self.base_url}/api/docs/{doc_id}/sql?q={sql_encoded}"
        print("🔗 URL SQL générée")
        print(f"📋 Requête décodée: {sql}")
        return url

    def test_url(self, url, test_values, api_key=None):
        """
        Teste une URL générée en remplaçant chaque placeholder par sa valeur.
        test_values = {'id': 'cam', 'id2': 'accepte'}
        """
        test_url = url
        for placeholder_name, value in test_values.items():
            test_url = test_url.replace("{" + placeholder_name + "}", str(value))
        try:
            print("🧪 Test de l'URL")
            response = requests.get(test_url, headers=self.get_headers(api_key))
            response.raise_for_status()
            data = response.json()
            print(f"✅ Test réussi: {len(data.get('records', []))} enregistrements")
            return {
                "success": True,
                "data": data,
                "test_url": test_url,
                "status_code": response.status_code,
            }
        except Exception as e:
            print(f"❌ Erreur lors du test: {e}")
            return {"success": False, "error": str(e), "test_url": test_url}


# Initialisation du client Grist
grist_client = GristAPIClient(GRIST_BASE_URL, API_KEY)


@app.route("/")
def index():
    """Page principale avec le formulaire"""
    return render_template("index.html")


@app.route("/test_api", methods=["POST"])
@limiter.limit("10 per minute")
def test_api():
    """Test de la clé API Grist"""
    try:
        data = request.get_json()
        api_key = data.get("api_key", "")

        if not api_key:
            return jsonify(
                {"success": False, "message": "Token API manquant", "status": 400}
            ), 400

        # Test avec un appel à l'API Grist
        url = f"{GRIST_BASE_URL}/api/orgs"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            return jsonify(
                {
                    "success": True,
                    "message": f"Token API valide ! Vous avez accès à {len(data)} organisation(s).",
                    "status": response.status_code,
                }
            )
        else:
            return jsonify(
                {
                    "success": False,
                    "message": f"Erreur {response.status_code}: {response.text[:200]}",
                    "status": response.status_code,
                }
            ), response.status_code

    except Exception as e:
        return jsonify(
            {
                "success": False,
                "message": f"Erreur de connexion: {str(e)}",
                "status": "error",
            }
        ), 500


@app.route("/api/tables/<doc_id>")
def get_tables_api(doc_id):
    """API pour récupérer les tables d'un document"""
    api_key = request.headers.get("Authorization", "").replace("Bearer ", "")
    tables = grist_client.get_tables(doc_id, api_key)
    return jsonify(tables)


@app.route("/api/columns/<doc_id>/<table_name>")
def get_columns_api(doc_id, table_name):
    """API pour récupérer les colonnes d'une table"""
    api_key = request.headers.get("Authorization", "").replace("Bearer ", "")
    columns = grist_client.get_columns(doc_id, table_name, api_key)
    return jsonify(columns)


@app.route("/generate_url", methods=["POST"])
@limiter.limit("20 per minute")
def generate_url():
    """Génère l'URL d'API Grist"""
    doc_id = request.form.get("doc_id")
    table_name = request.form.get("table_name")
    column_name = request.form.get("column_name")
    api_key = request.form.get("api_key", "")

    if not doc_id or not table_name or not column_name:
        return jsonify({"error": "Document ID, table et colonne requis"}), 400

    # Récupération du nom du document
    doc_name = grist_client.get_document_info(doc_id, api_key)

    url = grist_client.generate_filter_url(doc_id, table_name, column_name)

    return jsonify(
        {
            "url": url,
            "doc_name": doc_name,
            "doc_id": doc_id,
            "table": table_name,
            "column": column_name,
            "format_info": "Remplacez {id} par le tag Démarche Numérique",
            "usage": "Dans Démarche Numérique : insérez la balise \"Valeur saisie par l'usager\" à la place de {{id}} pour construire l'URL dynamique",
        }
    )


@app.route("/generate_url_advanced", methods=["POST"])
@limiter.limit("20 per minute")
def generate_url_advanced():
    """Génère l'URL d'API Grist avec filtres multiples"""
    try:
        data = request.get_json()
        doc_id = data.get("doc_id")
        table_name = data.get("table_name")
        filters = data.get("filters", [])  # Liste de filtres
        api_key = data.get("api_key", "")

        if not doc_id or not table_name or not filters:
            return jsonify({"error": "Document ID, table et filtres requis"}), 400

        # Récupération du nom du document
        doc_name = grist_client.get_document_info(doc_id, api_key)

        # Générer URL avec filtres multiples
        url = grist_client.generate_filter_url_advanced(doc_id, table_name, filters)

        return jsonify(
            {
                "url": url,
                "doc_name": doc_name,
                "doc_id": doc_id,
                "table": table_name,
                "filters": filters,
                "format_info": "Remplacez {id} par le tag Démarche Numérique",
                "usage": "Dans Démarche Numérique : insérez la balise \"Valeur saisie par l'usager\" à la place de {id} pour construire l'URL dynamique",
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/generate_url_sql", methods=["POST"])
@limiter.limit("20 per minute")
def generate_url_sql():
    """Génère l'URL d'API Grist via l'endpoint /sql (mode avancé SQL)"""
    try:
        data = request.get_json()
        doc_id = data.get("doc_id")
        table_name = data.get("table_name")
        conditions = data.get("conditions", [])
        connector = data.get("connector", "AND")
        order_by = data.get("order_by")  # optionnel: {'column': ..., 'direction': ...}
        limit = data.get("limit", 20)
        api_key = data.get("api_key", "")

        if not doc_id or not table_name or not conditions:
            return jsonify({"error": "Document ID, table et conditions requis"}), 400

        if connector not in ("AND", "OR"):
            return jsonify({"error": "Le connecteur doit être AND ou OR"}), 400

        # Récupération du nom du document
        doc_name = grist_client.get_document_info(doc_id, api_key)

        # Générer l'URL SQL
        url = grist_client.generate_sql_url(
            doc_id, table_name, conditions, connector, order_by, limit
        )

        return jsonify(
            {
                "url": url,
                "doc_name": doc_name,
                "doc_id": doc_id,
                "table": table_name,
                "conditions": conditions,
                "connector": connector,
                "order_by": order_by,
                "limit": limit,
                "format_info": "Remplacez chaque {id}, {id2}, {id3}... par le tag Démarche Numérique correspondant",
                "usage": "Dans Démarche Numérique : insérez la balise \"Valeur saisie par l'usager\" à la place de {id}. S'il y a d'autres placeholders ({id2}, {id3}...), remplacez-les par les balises des champs du formulaire déjà renseignés par l'usager, dans l'ordre où ils apparaissent dans l'URL.",
            }
        )

    except ValueError as e:
        return jsonify({"error": f"Erreur de validation : {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/test_url", methods=["POST"])
@limiter.limit("15 per minute")
def test_url_endpoint():
    """Teste une URL générée avec une ou plusieurs valeurs de test"""
    try:
        data = request.get_json()
        url = data.get("url")
        test_values = data.get("test_values")
        api_key = data.get("api_key", "")

        if not url or not test_values:
            return jsonify({"error": "URL et valeurs de test requis"}), 400

        result = grist_client.test_url(url, test_values, api_key)

        if result["success"]:
            return jsonify(
                {
                    "success": True,
                    "data": result["data"],
                    "test_url": result["test_url"],
                    "status_code": result["status_code"],
                    "message": f"Test réussi avec {len(result['data'].get('records', []))} enregistrement(s) trouvé(s)",
                }
            )
        else:
            return jsonify(
                {
                    "success": False,
                    "error": result["error"],
                    "test_url": result["test_url"],
                }
            ), 400

    except Exception as e:
        return jsonify(
            {"success": False, "error": f"Erreur lors du test: {str(e)}"}
        ), 500


# Gestion des erreurs
@app.errorhandler(404)
def not_found(error):
    return render_template("404.html"), 404


@app.errorhandler(500)
def internal_error(error):
    return render_template("500.html"), 500


# Headers de sécurité
@app.after_request
def set_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if request.is_secure:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


if __name__ == "__main__":
    print("🚀 Application Flask prête avec interface DSFR !")
    print("🔑 Token API peut être saisi dans l'interface")
    print("🎨 Interface DSFR activée")
    print("🌐 Accédez à l'application sur http://localhost:5000")

    app.run(debug=True)
