pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
    timestamps()
    timeout(time: 20, unit: 'MINUTES')
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
          env.SHORT_SHA = scmVars.GIT_COMMIT.take(7)
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
        sh 'npm ci'
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
            sh 'npx vitest run tests --exclude tests/integration/** --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml'
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
stage('Debug') {
  steps {
    echo "GIT_BRANCH=${env.GIT_BRANCH} BRANCH_NAME=${env.BRANCH_NAME}"
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
