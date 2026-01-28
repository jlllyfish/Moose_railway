# 🔧 Générateur d'URL Grist DSFR

> Outil simple pour générer des URLs d'API Grist avec filtres dynamiques

## 🎯 À quoi ça sert ?

Cet outil vous permet de **générer facilement des URLs d'API Grist** pour récupérer des données filtrées. Au lieu de construire manuellement des URLs complexes, vous :

1. **Connectez** votre document Grist
2. **Sélectionnez** une table et une colonne
3. **Obtenez** une URL prête à utiliser dans vos applications

**Exemple concret :**
Vous avez une table "Établissements" avec une colonne "Type" et vous voulez récupérer seulement les LPA.

**Sans l'outil :** vous devez construire manuellement :
```
https://grist.numerique.gouv.fr/api/docs/abc123/tables/Etablissements/records?filter=%7B%22Type%22%3A%5B%22LPA%22%5D%7D
```

**Avec l'outil :** vous sélectionnez simplement "Établissements" → "Type" et vous obtenez :
```
https://grist.numerique.gouv.fr/api/docs/abc123/tables/Etablissements/records?filter={"Type":["{id}"]}
```

Le `{id}` est un placeholder que vous remplacez par "LPA" ou toute autre valeur.

## 🚀 Comment ça marche ?

### Interface simple en 6 étapes

1. **Testez votre clé API** - Vérifiez que vous êtes connecté à Grist
2. **Saisissez l'ID** de votre document Grist
3. **Chargez les tables** - L'outil récupère automatiquement vos tables
4. **Sélectionnez une table** - Choisissez dans la liste
5. **Sélectionnez une colonne** - Choisissez la colonne pour filtrer
6. **Récupérez l'URL** - Copiez l'URL générée

### Bonus : Test intégré
- Testez votre URL directement dans l'interface
- Entrez une valeur d'exemple
- Visualisez les résultats en JSON

## 📥 Installation

### Prérequis
- **Python 3.8+** installé sur votre système
- **Compte Grist** avec une clé API

### Étapes d'installation

1. **Téléchargez le projet**
```bash
git clone https://github.com/votre-username/generateur-url-grist.git
cd generateur-url-grist
```

2. **Créez un environnement virtuel**
```bash
python -m venv venv

# Activez l'environnement virtuel
# Sur Windows :
venv\Scripts\activate
# Sur macOS/Linux :
source venv/bin/activate
```

3. **Installez les dépendances**
```bash
pip install -r requirements.txt
```

4. **Configurez votre clé API**
```bash
# Copiez le fichier d'exemple
cp .env.example .env

# Éditez le fichier .env
nano .env
```

Ajoutez votre clé API dans le fichier `.env` :
```env
GRIST_API_KEY=votre_cle_api_grist_ici
```

5. **Lancez l'application**
```bash
python app.py
```

**L'application est accessible sur :** `http://localhost:5000`

## 🔑 Obtenir votre clé API Grist

1. Connectez-vous sur [grist.numerique.gouv.fr](https://grist.numerique.gouv.fr)
2. Cliquez sur votre profil (en haut à droite)
3. Sélectionnez **"Paramètres"**
4. Dans la section **"API"**, cliquez sur **"Créer une clé API"**
5. Copiez la clé générée et collez-la dans votre fichier `.env`

## 🖥️ Utilisation

### Étape 1 : Vérifier la connexion
- Cliquez sur **"Tester la clé API"**
- Un message doit confirmer que votre clé fonctionne

### Étape 2 : Sélectionner votre document
- Saisissez l'**ID de votre document Grist**
- Vous le trouvez dans l'URL de votre document : `https://grist.../docs/VOTRE_ID/...`

### Étape 3 : Naviguer dans vos données
- Cliquez sur **"Charger les tables"**
- Sélectionnez une **table** dans la liste déroulante
- Sélectionnez une **colonne** pour le filtrage

### Étape 4 : Générer et utiliser
- Cliquez sur **"Générer l'URL"**
- **Copiez l'URL** générée
- **Testez l'URL** (optionnel) avec une valeur d'exemple

## 💻 Utiliser l'URL générée

### Dans votre code JavaScript
```javascript
// Remplacez {id} par votre valeur
const url = "https://grist.../records?filter={\"Type\":[\"LPA\"]}";

fetch(url, {
    headers: {
        'Authorization': 'Bearer VOTRE_CLE_API'
    }
})
.then(response => response.json())
.then(data => {
    console.log(data.records); // Vos données filtrées
});
```

### Dans votre code Python
```python
import requests

url = "https://grist.../records?filter={\"Type\":[\"LPA\"]}"
headers = {"Authorization": "Bearer VOTRE_CLE_API"}

response = requests.get(url, headers=headers)
data = response.json()
print(data['records'])  # Vos données filtrées
```

### Dans votre code PHP
```php
$url = "https://grist.../records?filter={\"Type\":[\"LPA\"]}";
$headers = array("Authorization: Bearer VOTRE_CLE_API");

$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => implode("\r\n", $headers)
    ]
]);

$response = file_get_contents($url, false, $context);
$data = json_decode($response, true);
print_r($data['records']); // Vos données filtrées
```

## 🔧 Fonctionnalités

### Interface
- ✅ **Design DSFR** - Interface moderne et accessible
- ✅ **Responsive** - Fonctionne sur mobile et desktop
- ✅ **Intuitive** - Pas besoin de manuel d'utilisation

### Fonctionnalités techniques
- ✅ **Test de clé API** - Vérification automatique de la connexion
- ✅ **Navigation guidée** - Sélection pas à pas des tables/colonnes
- ✅ **Génération automatique** - URLs complexes créées automatiquement
- ✅ **Test intégré** - Validation avec vos vraies données
- ✅ **Filtrage intelligent** - Masque les tables système de Grist

## 🛠️ Dépannage

### Erreur "Clé API manquante"
Vérifiez votre fichier `.env` :
```bash
cat .env
# Doit contenir : GRIST_API_KEY=votre_cle_api
```

### Erreur "Test de clé API échoué"
- Vérifiez que votre clé API est correcte
- Assurez-vous d'avoir accès à Grist
- Testez votre connexion internet

### Pas de tables dans la liste
- Vérifiez l'ID de votre document Grist
- Assurez-vous d'avoir les permissions de lecture
- Vérifiez que le document contient bien des tables

### L'application ne démarre pas
```bash
# Vérifiez que l'environnement virtuel est activé
which python
# Doit pointer vers venv/bin/python ou venv\Scripts\python.exe

# Réinstallez les dépendances
pip install -r requirements.txt
```

### Problème d'affichage
- Actualisez la page (F5)
- Vérifiez la console du navigateur (F12)
- Essayez avec un autre navigateur

## 🏗️ Structure du projet

```
generateur-url-grist/
├── app.py                 # Application Flask principale
├── requirements.txt       # Dépendances Python
├── .env.example          # Exemple de configuration
├── README.md             # Cette documentation
├── templates/            # Pages HTML
│   ├── base.html         # Template de base DSFR
│   ├── index.html        # Page principale
│   ├── 404.html          # Page d'erreur 404
│   └── 500.html          # Page d'erreur 500
└── static/               # Fichiers statiques
    ├── css/
    │   └── custom.css    # Styles personnalisés
    ├── js/
    │   └── main.js       # JavaScript principal
    └── dsfr/             # Fichiers DSFR (inclus)
        ├── css/          # Styles DSFR
        ├── js/           # Scripts DSFR
        └── fonts/        # Polices Marianne
```



### Problèmes fréquents
- **Clé API** : Vérifiez qu'elle est bien copiée dans `.env`
- **Permissions** : Assurez-vous d'avoir accès au document Grist
- **ID Document** : Vérifiez l'ID dans l'URL de votre document

---

**Prêt à simplifier vos intégrations API Grist ? 🚀**