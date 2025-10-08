# Guide d'utilisation - DASH Validateur RAMQ

**Version**: 1.0
**Date**: Octobre 2025
**Public cible**: Administrateurs médicaux, personnel de facturation, médecins

---

## Table des matières

1. [Introduction](#introduction)
2. [Accès et connexion](#accès-et-connexion)
3. [Téléverser un fichier de facturation](#téléverser-un-fichier-de-facturation)
4. [Comprendre les résultats de validation](#comprendre-les-résultats-de-validation)
5. [Corriger les erreurs courantes](#corriger-les-erreurs-courantes)
6. [Gestion des codes RAMQ](#gestion-des-codes-ramq)
7. [Foire aux questions (FAQ)](#foire-aux-questions-faq)
8. [Support technique](#support-technique)

---

## Introduction

**DASH** est une plateforme de validation de facturation RAMQ pour le système de santé québécois. Elle permet aux administrateurs médicaux de :

- ✅ Valider les fichiers CSV de facturation **avant** leur soumission à la RAMQ
- 🔍 Identifier les erreurs de facturation selon les règles officielles du Québec
- 📊 Consulter les codes RAMQ, contextes et établissements de santé
- 📈 Améliorer la conformité et réduire les rejets de facturation

### Avantages

- **Gain de temps** : Détection automatique des erreurs en quelques secondes
- **Conformité RAMQ** : 123+ règles de validation basées sur les règlements officiels
- **Réduction des rejets** : Identification proactive des problèmes avant soumission
- **Interface en français** : Adaptée au contexte québécois

---

## Accès et connexion

### URL de production
**https://148.113.196.245**

### Authentification

DASH utilise **Auth0** pour une connexion sécurisée :

1. Cliquez sur **"Se connecter"** dans le coin supérieur droit
2. Entrez votre adresse courriel autorisée (@facturation.net)
3. Suivez les instructions d'authentification Auth0
4. Une fois connecté, vous serez redirigé vers le tableau de bord

### Rôles utilisateur

| Rôle | Permissions |
|------|-------------|
| **Pending** | Aucun accès (en attente d'approbation) |
| **Viewer** | Lecture seule (consultation des codes et validations) |
| **Editor** | Lecture + écriture (téléversement de fichiers, validation) |
| **Admin** | Accès complet (gestion des utilisateurs, suppressions) |

---

## Téléverser un fichier de facturation

### Format de fichier accepté

- **Type** : CSV (valeurs séparées par des virgules ou des point-virgules)
- **Taille maximale** : 10 MB
- **Encodage** : UTF-8 avec BOM ou ISO-8859-1 (détection automatique)
- **Délimiteur** : Virgule (`,`) ou point-virgule (`;`) détecté automatiquement

### Colonnes requises

Le fichier CSV doit contenir au minimum les colonnes suivantes :

| # | Nom de colonne | Description | Exemple |
|---|----------------|-------------|---------|
| 2 | **Facture** | Numéro de facture interne | 123456 |
| 3 | **ID RAMQ** | Numéro de facture RAMQ officiel | 987654321 |
| 4 | **Date de Service** | Date du service médical | 2025-02-05 |
| 5 | **Début** | Heure de début | 09:00 |
| 6 | **Fin** | Heure de fin | 09:30 |
| 8 | **Lieu de pratique** | Code d'établissement | 12345 |
| 9 | **Secteur d'activité** | Secteur (cabinet, établissement) | Cabinet |
| 10 | **Diagnostic** | Code de diagnostic | 123 |
| 11 | **Code** | **Code de facturation RAMQ** | 19929 |
| 12 | **Unités** | Unités (temps, longueur, etc.) | 1 |
| 13 | **Rôle** | Rôle du médecin (1=principal, autre=assistant) | 1 |
| 14 | **Élément de contexte** | Modificateurs de contexte | G160 |
| 15 | **Montant Préliminaire** | Montant prévu | 64,80 |
| 16 | **Montant payé** | Montant reçu | 64,80 |
| 17 | **Doctor Info** | Informations sur le médecin | 1068303-00000 |
| 22 | **Patient** | Identifiant unique du patient | PAT001 |

### Procédure de téléversement

1. **Accédez au module Validateur**
   - Cliquez sur **"Validateur"** dans la barre latérale gauche

2. **Sélectionnez votre fichier**
   - Cliquez sur la zone de téléversement ou glissez-déposez votre fichier CSV
   - Le fichier sera validé pour le format et la taille

3. **Lancez la validation**
   - Cliquez sur le bouton **"Valider"**
   - Une barre de progression s'affichera pendant le traitement

4. **Consultez les résultats**
   - Une fois terminé, les résultats de validation s'affichent automatiquement
   - Vous pouvez télécharger un rapport CSV des erreurs trouvées

---

## Comprendre les résultats de validation

### Niveaux de sévérité

| Icône | Niveau | Description | Action requise |
|-------|--------|-------------|----------------|
| 🔴 | **Erreur** | Violation d'une règle RAMQ officielle | **OBLIGATOIRE** : Corriger avant soumission |
| 🟡 | **Avertissement** | Situation inhabituelle à vérifier | **RECOMMANDÉ** : Vérifier la facturation |
| ℹ️ | **Information** | Note informative ou suggestion | **OPTIONNEL** : Pour référence |

### Catégories d'erreurs

#### 1. Prohibition
**Codes prohibés sur la même facture**

**Exemple** :
```
🔴 ERREUR : Les codes 08129 et 08135 sont prohibés sur la même facture
Facture : 123456
Patient : PAT001
```

**Solution** : Séparez ces codes sur des factures différentes.

#### 2. Restriction temporelle
**Temps minimum requis entre services**

**Exemple** :
```
🔴 ERREUR : Le code 19900 requiert un minimum de 7 jours entre les visites
Dernière visite : 2025-02-01
Visite actuelle : 2025-02-03 (seulement 2 jours)
```

**Solution** : Respectez le délai minimum de 7 jours entre les services.

#### 3. Exigence de contexte
**Code nécessite un contexte spécifique**

**Exemple** :
```
🔴 ERREUR : Le code 15804 requiert le contexte #M pour modification tarifaire
Contexte actuel : Aucun
```

**Solution** : Ajoutez le contexte requis (#M) dans la colonne "Élément de contexte".

#### 4. Frais de bureau (19928/19929)
**Seuils de patients non atteints**

**Exemple** :
```
🔴 ERREUR : Le code 19929 requiert un minimum de 12 patients inscrits
Patients trouvés : 8 patients inscrits
Montant : 64,80$ (au lieu de 32,40$ pour le code 19928)
```

**Solution** : Utilisez le code 19928 (6-11 patients) au lieu du 19929 (12+ patients).

#### 5. Limite de montant
**Montant quotidien/annuel dépassé**

**Exemple** :
```
🔴 ERREUR : Limite quotidienne des frais de bureau dépassée
Montant actuel : 97,20$
Limite maximale : 64,80$ par médecin par jour
```

**Solution** : Vérifiez que vous n'avez pas facturé des frais de bureau en double.

#### 6. Code à facturation annuelle
**Code ne peut être facturé qu'une fois par an**

**Exemple** :
```
🔴 ERREUR : Le code "Visite de prise en charge" ne peut être facturé qu'une fois par patient par année civile
Patient : PAT001
Facturations en cours : 2 (une déjà payée)
```

**Solution** : Supprimez les facturations en double. Contactez la RAMQ si une est déjà payée.

---

## Corriger les erreurs courantes

### Erreur #1 : Code 19929 - Minimum de patients non atteint

**Message complet** :
```
🔴 ERREUR : Le code 19929 requiert un minimum de 12 patients inscrits mais seulement 8 trouvé(s).
Montant facturé : 64,80$
Montant recommandé : 32,40$ (code 19928 pour 6-11 patients)
```

**Explication** :
- Le code **19929** est pour 12+ patients inscrits (64,80$/jour)
- Le code **19928** est pour 6-11 patients inscrits (32,40$/jour)
- Les patients **sans rendez-vous** (walk-in) ont des seuils différents :
  - 19928 : Maximum 10 patients sans rendez-vous
  - 19929 : Maximum 20 patients sans rendez-vous

**Solution** :
1. Comptez vos patients inscrits (excluant les sans rendez-vous)
2. Si vous avez 6-11 patients → Utilisez le code **19928**
3. Si vous avez 12+ patients → Utilisez le code **19929**
4. Pour les patients sans rendez-vous, ajoutez le contexte **#G160** ou **#AR**

---

### Erreur #2 : Codes prohibés 08129 et 08135

**Message complet** :
```
🔴 ERREUR : Les codes 08129 (suivi gynécologique) et 08135 (examen gynécologique complet)
sont prohibés sur la même facture.
Facture : 123456
```

**Explication** :
Ces codes représentent des services qui ne peuvent pas être facturés ensemble selon la RAMQ.

**Solution** :
- Créez **deux factures distinctes** pour ces codes
- Ou choisissez le code le plus approprié pour le service rendu

---

### Erreur #3 : Contexte manquant

**Message complet** :
```
🔴 ERREUR : Le code 15804 (visite de suivi) requiert le contexte #M
pour modification tarifaire en établissement.
Contexte actuel : Aucun
```

**Explication** :
Certains codes RAMQ nécessitent des modificateurs de contexte pour être valides.

**Solution** :
1. Consultez la documentation RAMQ pour le code concerné
2. Ajoutez le contexte requis dans la colonne **"Élément de contexte"**
3. Exemple : Pour le code 15804 en établissement, ajoutez **#M**

---

### Erreur #4 : Délai minimum non respecté

**Message complet** :
```
🔴 ERREUR : Le code 19900 (visite périodique) requiert un minimum de 7 jours entre les visites.
Dernière visite : 2025-02-01
Visite actuelle : 2025-02-03 (seulement 2 jours)
Patient : PAT001
```

**Explication** :
La RAMQ impose des délais minimums entre certains services pour éviter la surfacturation.

**Solution** :
- Vérifiez la date de la dernière visite du patient
- Assurez-vous que le délai minimum est respecté
- Utilisez un code différent si le service est urgent et justifié

---

## Gestion des codes RAMQ

### Consulter les codes

1. Cliquez sur **"Base de Données"** dans la barre latérale
2. Sélectionnez **"Codes"**
3. Utilisez la barre de recherche pour trouver un code spécifique

### Informations disponibles

Pour chaque code, vous pouvez consulter :

- **Code** : Numéro du code RAMQ (ex: 19929)
- **Description** : Description en français du service
- **Tarif** : Montant en dollars canadiens (CAD)
- **Lieu** : Cabinet ou Établissement
- **Niveau** : Niveau de complexité du service
- **Groupe** : Groupe tarifaire RAMQ
- **Statut** : Actif ou Inactif

### Exemple de fiche de code

```
Code : 19929
Description : Frais de bureau - 12 patients inscrits ou plus
Tarif : 64,80 $
Lieu : Cabinet
Statut : ✅ Actif
Notes : Maximum 64,80$ par médecin par jour. Pour walk-in, maximum 20 patients.
```

---

## Foire aux questions (FAQ)

### Q1 : Pourquoi mes fichiers CSV ne se téléversent pas ?

**R** : Vérifiez les points suivants :
- Taille du fichier < 10 MB
- Format : CSV avec virgule ou point-virgule
- Encodage : UTF-8 avec BOM ou ISO-8859-1
- Colonnes requises présentes (Facture, Code, Date de Service, etc.)

### Q2 : Comment corriger une erreur déjà soumise à la RAMQ ?

**R** : DASH valide **avant** la soumission. Si vous avez déjà soumis une facture avec des erreurs :
1. Contactez la RAMQ directement pour annuler la facture
2. Corrigez les erreurs dans votre fichier CSV
3. Re-validez avec DASH avant de soumettre à nouveau

### Q3 : Puis-je téléverser plusieurs fichiers en même temps ?

**R** : Non, un seul fichier à la fois. Fusionnez vos fichiers CSV avant téléversement si nécessaire.

### Q4 : Les résultats de validation sont-ils conservés ?

**R** : Oui, l'historique des validations est conservé dans votre compte. Accédez à **"Validateur" → "Exécutions"** pour consulter les validations passées.

### Q5 : Comment puis-je obtenir un rôle "Editor" ou "Admin" ?

**R** : Contactez l'administrateur système de votre organisation. Seul un administrateur peut modifier les rôles utilisateur.

### Q6 : Le système est-il conforme HIPAA pour les données PHI ?

**R** : Oui, DASH est conforme aux exigences de protection des renseignements personnels sur la santé (PHI) :
- Chiffrement des données en transit et au repos
- Contrôle d'accès basé sur les rôles (RBAC)
- Journalisation des accès aux données sensibles
- Redaction automatique des informations patient dans les journaux

### Q7 : Que faire si je trouve une erreur dans les règles de validation ?

**R** : Signalez le problème à l'équipe de support en incluant :
- Le code RAMQ concerné
- Le message d'erreur complet
- Un exemple de fichier CSV (données anonymisées)
- La référence au règlement RAMQ si applicable

---

## Support technique

### Ressources en ligne

- **Documentation complète** : [docs/](../)
- **Guide des règles de validation** : [docs/modules/validateur/](../modules/validateur/)
- **GitHub Issues** : https://github.com/montignypatrik/facnet-validator/issues

### Contact

Pour toute question technique ou problème d'utilisation :

1. **Vérifiez d'abord** la section FAQ ci-dessus
2. **Consultez** la documentation en ligne
3. **Contactez** le support technique de votre organisation

### Heures de disponibilité

- **Système** : 24/7 (disponible en tout temps)
- **Support technique** : Lundi-Vendredi, 8h00-17h00 (HNE)

---

**Dernière mise à jour** : Octobre 2025
**Version du document** : 1.0
**Plateforme** : DASH v1.0.0
