from flask import Flask, render_template, request, jsonify
import requests
import urllib.parse
import json
import os
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Chargement des variables d'environnement
load_dotenv()

app = Flask(__name__)

# Configuration de sécurité
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24))
app.config['SESSION_COOKIE_SECURE'] = True  # HTTPS only
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Configuration
GRIST_BASE_URL = "https://grist.numerique.gouv.fr"
API_KEY = os.getenv('GRIST_API_KEY', '')

class GristAPIClient:
    def __init__(self, base_url, api_key=None):
        self.base_url = base_url
        self.api_key = api_key
        
    def get_headers(self, api_key=None):
        """Génère les headers avec la clé API"""
        key = api_key or self.api_key
        if not key:
            raise ValueError("API key required")
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
    
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
            doc_name = data.get('name') or data.get('title') or data.get('docName') or "Document sans nom"
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
                'GristDocTour',
                'GristHidden_import',
                '_grist_Tables',
                '_grist_Tables_column',
                '_grist_Views',
                '_grist_Views_section',
                '_grist_Views_section_field',
                '_grist_TabBar',
                '_grist_Pages',
                '_grist_Attachments',
                '_grist_Cells',
                '_grist_ACLResources',
                '_grist_ACLRules',
                '_grist_ACLMemberships'
            ]
            
            all_tables = [table['id'] for table in data.get('tables', [])]
            
            # Filtrer les tables qui commencent par _ ou qui sont dans la liste d'exclusion
            filtered_tables = [
                table for table in all_tables 
                if not table.startswith('_grist_') and table not in excluded_tables
            ]
            
            print(f"📋 Tables trouvées: {len(all_tables)} (total), {len(filtered_tables)} (filtrées)")
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
            columns = [col['id'] for col in data.get('columns', [])]
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
        filter_encoded = filter_encoded.replace('PLACEHOLDER_ID', '{id}')
        
        url = f"{self.base_url}/api/docs/{doc_id}/tables/{table_name}/records?filter={filter_encoded}"
        print("🔗 URL générée")
        print(f"📋 Filtre décodé: {urllib.parse.unquote(filter_encoded)}")
        return url
    
    def test_url(self, url, test_value, api_key=None):
        """Teste une URL générée avec une valeur de test"""
        # Remplacer {id} par la valeur de test dans l'URL
        test_url = url.replace('{id}', str(test_value))
        try:
            print("🧪 Test de l'URL")
            response = requests.get(test_url, headers=self.get_headers(api_key))
            response.raise_for_status()
            data = response.json()
            print(f"✅ Test réussi: {len(data.get('records', []))} enregistrements")
            return {
                'success': True,
                'data': data,
                'test_url': test_url,
                'status_code': response.status_code
            }
        except Exception as e:
            print(f"❌ Erreur lors du test: {e}")
            return {
                'success': False,
                'error': str(e),
                'test_url': test_url
            }

# Initialisation du client Grist
grist_client = GristAPIClient(GRIST_BASE_URL, API_KEY)

@app.route('/')
def index():
    """Page principale avec le formulaire"""
    return render_template('index.html')

@app.route('/widget')
def widget():
    """Widget Grist - Doc ID auto, token manuel"""
    return render_template('widget.html')

@app.route('/test_api', methods=['POST'])
@limiter.limit("10 per minute")
def test_api():
    """Test de la clé API Grist"""
    try:
        data = request.get_json()
        api_key = data.get('api_key', '')
        
        if not api_key:
            return jsonify({
                'success': False,
                'message': 'Token API manquant',
                'status': 400
            }), 400
        
        # Test avec un appel à l'API Grist
        url = f"{GRIST_BASE_URL}/api/orgs"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                'success': True,
                'message': f'Token API valide ! Vous avez accès à {len(data)} organisation(s).',
                'status': response.status_code
            })
        else:
            return jsonify({
                'success': False,
                'message': f'Erreur {response.status_code}: {response.text[:200]}',
                'status': response.status_code
            }), response.status_code
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erreur de connexion: {str(e)}',
            'status': 'error'
        }), 500

@app.route('/api/tables/<doc_id>')
def get_tables_api(doc_id):
    """API pour récupérer les tables d'un document"""
    api_key = request.headers.get('Authorization', '').replace('Bearer ', '')
    tables = grist_client.get_tables(doc_id, api_key)
    return jsonify(tables)

@app.route('/api/columns/<doc_id>/<table_name>')
def get_columns_api(doc_id, table_name):
    """API pour récupérer les colonnes d'une table"""
    api_key = request.headers.get('Authorization', '').replace('Bearer ', '')
    columns = grist_client.get_columns(doc_id, table_name, api_key)
    return jsonify(columns)

@app.route('/generate_url', methods=['POST'])
@limiter.limit("20 per minute")
def generate_url():
    """Génère l'URL d'API Grist"""
    doc_id = request.form.get('doc_id')
    table_name = request.form.get('table_name')
    column_name = request.form.get('column_name')
    api_key = request.form.get('api_key', '')
    
    if not doc_id or not table_name or not column_name:
        return jsonify({'error': 'Document ID, table et colonne requis'}), 400
    
    # Récupération du nom du document
    doc_name = grist_client.get_document_info(doc_id, api_key)
    
    url = grist_client.generate_filter_url(doc_id, table_name, column_name)
    
    return jsonify({
        'url': url,
        'doc_name': doc_name,
        'doc_id': doc_id,
        'table': table_name,
        'column': column_name,
        'format_info': 'Le placeholder {id} sera remplacé par la valeur du champ (avec guillemets automatiques)',
        'usage': f'Cette URL filtrera la table "{table_name}" sur la colonne "{column_name}" avec la valeur saisie à la place de {{id}}'
    })

@app.route('/test_url', methods=['POST'])
@limiter.limit("15 per minute")
def test_url_endpoint():
    """Teste une URL générée avec une valeur de test"""
    try:
        data = request.get_json()
        url = data.get('url')
        test_value = data.get('test_value')
        api_key = data.get('api_key', '')
        
        if not url or not test_value:
            return jsonify({'error': 'URL et valeur de test requis'}), 400
        
        result = grist_client.test_url(url, test_value, api_key)
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result['data'],
                'test_url': result['test_url'],
                'status_code': result['status_code'],
                'message': f'Test réussi avec {len(result["data"].get("records", []))} enregistrement(s) trouvé(s)'
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error'],
                'test_url': result['test_url']
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Erreur lors du test: {str(e)}'
        }), 500

# Gestion des erreurs
@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

# Headers de sécurité
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    if request.is_secure:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

if __name__ == '__main__':
    print("🚀 Application Flask prête avec interface DSFR !")
    print("🔑 Token API peut être saisi dans l'interface")
    print("🎨 Interface DSFR activée")
    print("🌐 Accédez à l'application sur http://localhost:5000")
    
    app.run(debug=True)
