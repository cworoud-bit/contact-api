pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
    timestamps()
    timeout(time: 40, unit: 'MINUTES')
  }

  environment {
    IMAGE_NAME = 'root04602/contact-api'
  }

  stages {
    stage('Checkout') {
      steps {
        script {
          def scmVars = checkout scm
          env.GIT_COMMIT = scmVars.GIT_COMMIT
          env.GIT_BRANCH = scmVars.GIT_BRANCH
          env.SHORT_SHA  = scmVars.GIT_COMMIT.take(7)
        }
        echo "Commit ${env.SHORT_SHA}"
      }
    }

    stage('Install') {
      agent {
        docker {
          image 'node:24-alpine'
          args '-e npm_config_cache=/tmp/.npm'
          reuseNode true
        }
      }
      steps {
        retry(2) {
          sh 'npm ci --fetch-retries=5 --fetch-retry-mintimeout=2000 --fetch-timeout=60000'
        }
      }
    }

    stage('Quality') {
      parallel {
        stage('Lint') {
          agent {
            docker {
              image 'node:24-alpine'
              args '-e npm_config_cache=/tmp/.npm'
              reuseNode true
            }
          }
          steps {
            sh 'npm run lint'
          }
        }
        stage('Unit tests') {
          agent {
            docker {
              image 'node:24-alpine'
              args '-e npm_config_cache=/tmp/.npm'
              reuseNode true
            }
          }
          steps {
            sh "npx vitest run tests --exclude 'tests/integration/**' --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml"
          }
        }
      }
    }

    stage('Security') {
      parallel {
        stage('Gitleaks') {
          steps {
            sh 'mkdir -p reports'
            sh 'docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.30.0 git /repo --report-format json --report-path /repo/reports/gitleaks.json'
          }
        }
        stage('Semgrep') {
          steps {
            sh 'mkdir -p reports'
            sh 'docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e SEMGREP_SEND_METRICS=off -v "$PWD:/src" semgrep/semgrep semgrep scan --config p/javascript --config p/owasp-top-ten --error --json --output /src/reports/semgrep.json /src'
          }
        }
        stage('npm audit') {
          agent {
            docker {
              image 'node:24-alpine'
              args '-e npm_config_cache=/tmp/.npm'
              reuseNode true
            }
          }
          steps {
            sh 'mkdir -p reports && npm audit --audit-level=critical --json > reports/npm-audit.json'
          }
        }
      }
    }

    stage('Build image') {
      steps {
        sh 'docker build -t "$IMAGE_NAME:$SHORT_SHA" --label "org.opencontainers.image.revision=$GIT_COMMIT" .'
        sh 'echo "$IMAGE_NAME:$SHORT_SHA" > image.txt'
        archiveArtifacts artifacts: 'image.txt', fingerprint: true
      }
    }

    stage('Image scan') {
      steps {
        sh '''
          IGN=""
          if [ -f .trivyignore ]; then IGN="--ignorefile /src/.trivyignore"; fi
          docker run --rm -v trivy-cache:/root/.cache/ -v "$PWD:/src" \
            -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image $IGN \
            --severity CRITICAL --exit-code 1 "$IMAGE_NAME:$SHORT_SHA"
        '''
      }
    }

    stage('Push') {
      when {
        expression {
          def b = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
          return b == 'main' || b == 'origin/main'
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub',
                          usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
          sh 'echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin'
          sh 'docker push "$IMAGE_NAME:$SHORT_SHA"'
          sh 'docker logout'
        }
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'reports/junit.xml'
      archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
    }
    success {
      echo "Pipeline réussi : ${env.IMAGE_NAME}:${env.SHORT_SHA}"
    }
    failure {
      echo 'Pipeline en échec : voir les logs du stage concerné.'
    }
    cleanup {
      sh 'docker image prune -f || true'
      cleanWs()
    }
  }
}
