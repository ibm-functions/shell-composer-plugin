/*
 * Copyright 2017 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require('path'),
      ROOT = process.env.TEST_ROOT,
      ui = require(path.join(ROOT, 'lib/ui')),
      badges = require(path.join(ROOT, '../app/plugins/modules/composer/lib/badges.js')),
      assert = require('assert'),
      cli = ui.cli,
      sidecar = ui.sidecar

/**
 * Helper to find an input file
 *
 */
const input = (file, subdir='.') => ({
    file,
    path: path.join('data', subdir, file)
})
const composerInput = file => input(file, 'composer-source')
const composerErrorInput = file => input(file, 'composer-source-expect-errors')

/**
 * Verify that a node with the given action name exists on the canvas
 *
 */
const verifyNodeExists = (name, isDeployed=false) => app => {
    const selector = `#wskflowSVG .node[data-name="/_/${name}"][data-deployed="${isDeployed ? 'deployed' : 'not-deployed'}"]`
    console.error(`CHECKING NODE ${name} ${selector}`)
    return app.client.waitUntil(() => app.client.elements(selector)
                                .then(nodes => nodes.value.length === 1))
        .then(() => app)
}

// for session - verify node execution status
const verifyNodeStatusExists = (name, status) => app => {
    const selector = `#wskflowSVG .node[data-name="/_/${name}"][data-status="${status}"]`
    console.error(`CHECKING NODE ${name} ${selector}`)
    return app.client.waitUntil(() => app.client.elements(selector)
                                .then(nodes => {
                                    console.error(`GOT ${nodes.value.length} NODES`)
                                    return nodes
                                })
                                .then(nodes => nodes.value.length === 1))
        .then(() => app)
        .catch(err => {
            // see if the data-status query is the problem
            const selector = `#wskflowSVG .node`
            console.error(`BACKUP CHECK ${name} ${selector}`)
            return app.client.waitUntil(() => app.client.getText(selector)
                                        .then(nodes => {
                                            console.error(`GOTb ${nodes.length} NODES`)
                                            console.error(nodes)

                                            return app.client.getAttribute(selector, 'data-name')
                                                .then(nodes => {
                                                    console.error(`GOTc ${nodes.length} NODES`)
                                                    console.error(nodes)
                                                })
                                        })
                                        .catch(err => true)
                                        .then(() => {
                                            throw err
                                        }))
        })
}

const verifyNodeExistsById = id => app => {
    return app.client.waitUntil(() => app.client.elements(`#wskflowSVG #${id}`)
                                .then(nodes => nodes.value.length === 1))
        .then(() => app)
}

/**
 * Verify that a edge between the given action names exists on the canvas
 *
 */
const verifyEdgeExists = (from, to) => app => {
    const selector = `#wskflowSVG path[data-from-name="/_/${from}"][data-to-name="/_/${to}"]`
    console.error(`CHECKING EDGE ${from} ${to} ${selector}`)
    return app.client.elements(selector)
        .then(edges => assert.equal(edges.value.length, 1))
        .then(() => app)
}

/**
 * Verify that an outgoing edge, coming from the given from node
 *
 */
const verifyOutgoingEdgeExists = from => app => app.client.elements(`#wskflowSVG path[data-from-name="/_/${from}"]`)
      .then(edges => assert.equal(edges.value.length, 1))
      .then(() => app)

/**
  * Look for any suspicious node labels
  *
  */
const verifyNodeLabelsAreSane = app => app.client.getText(`#wskflowSVG .node text`)
      .then(labels => typeof labels === 'string' ? [labels] : labels)
      .then(labels => labels.forEach(label => assert.ok(label.indexOf('[object Object]') < 0)))
      .then(() => app)

/**
 * Ensure that the basic attributes of the rendered graph are correct
 *
 */
const verifyTheBasicStuff = (file, badge) => _ => Promise.resolve(_)
      .then(cli.expectOK)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing(file))
      .then(sidecar.expectBadge(badges[badge]))
      .then(verifyNodeExistsById('Entry'))
      .then(verifyNodeExistsById('Exit'))
      .then(verifyNodeLabelsAreSane)

module.exports = {
    input,
    composerInput,
    composerErrorInput,
    verifyNodeExists,
    verifyNodeStatusExists,
    verifyNodeExistsById,
    verifyEdgeExists,
    verifyOutgoingEdgeExists,
    verifyNodeLabelsAreSane,
    verifyTheBasicStuff
}
