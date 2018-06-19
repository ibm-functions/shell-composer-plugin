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

const debug = require('debug')('composer-utils')
debug('starting')

const fs = require('fs'),
      path = require('path'),
      util = require('util'),
      //redis = require('redis'),
      openwhiskComposer = require('@ibm-functions/composer'),
      messages = require('./messages.json'),
      { app:appBadge } = require('./badges'),
      lsKey = 'ibm.cloud.composer.storage'

debug('modules loaded')

/** global constants */
const constants = {
    composerPackage: 'openwhisk-composer'
}

// cache of init()
/*let initDone, manager
const cacheIt = wsk => ({ package, message }) => {
    initDone = package

    const initManager = () => {
        manager = require('@ibm-functions/composer/manager')(wsk.auth.getSubjectId(),
                                                             package.parameters.find(({key})=>key==='$config').value.redis,
                                                             redisOpts(err => { console.error(err) }))

        return manager.list().catch(err => {
            console.error('Retrying redis connection')
            console.error(err.toString())
            console.error(err.code)
            return initManager()
        })
    }

    // when the window is closed, let's uncache this, and close our redis connection
    eventBus.on('/window/reload', () => {
        try {
            console.log('Uncaching manager')
            manager.quit()
            initDone = false
            manager = false
        } catch (err) {
            console.error(err)
        }
    })

    // localStorage.setItem(lsKey, JSON.stringify(package))

    return initManager()
        .then(() => ({ package, manager, message }))
}*/

/**
 * Report to the user that redis is slow in coming up
 *
 */
/*const slowInit = package => ({
    package,
    message: messages.slowInit
})*/

/*const redisOpts = handleError => ({
    connect_timeout: 5000,
    retry_strategy: options => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            // the redis host is unreachable, don't try again
            handleError(options.error)
        }
        if (options.total_retry_time > 1000 * 60) {
            // End reconnecting after a specific timeout and flush all commands
            // with a individual error
            handleError('retry time exceeded')
        }
        if (options.attempt > 30) {
            // End reconnecting with built in error
            handleError('retry count exceeded')
        }
        
        // otherwise, reconnect after some time interval...
        return Math.min(options.attempt * 100, 3000);
    }
})*/

/**
 * Wait till the redis service is pingable, then pass through the given res
 *
 */
/*const waitTillUp = (redisURI, options={}, package) => new Promise((resolve, reject) => {
    if (options.noping || options.url) {
        // don't ping if requested not to, or if the user specified a
        // direct URL; in the latter case, we assume that redis is
        // already up
        return resolve({package})
    }

    try {
        console.log('composer::waitTillUp')

        let client, alreadySaidDone
        const handleError = err => {
            try {
                client.quit()

                if (err) {
                    console.error(err)
                    resolve(slowInit(package))
                } else {
                    resolve({ package })
                }
            } catch (err2) {
                console.error(err2)
                resolve(slowInit(package))
            }
        }

        client = redis.createClient(redisURI, redisOpts(handleError))

        client.on('error', handleError)
        client.ping(handleError)
        client.quit()

    } catch (err) {
        console.error(err)
        reject('Internal Error')
    }
})*/

/**
 * Extract the redis uri from a service key
 *    TODO this probably belongs elsewhere, in the bluemix plugin e.g.
 *
 */
/*const uri = (key, {provider}={}) => {
    if (!provider || provider === 'redis') return key.uri
    else if (provider && provider === 'rediscloud') return `redis://:${key.password}@${key.hostname}:${key.port}`
}*/

/**
 * Acquire a redis instance
 *
 */
/*const acquireRedis = options => {
    if (options && options.url) {
        // use our shared redis instance
        return repl.qexec(`wsk package update bluemix.redis`, undefined, undefined, {
            parameters: {
                '_secrets': {
                    creds: {
                        uri: options.url
                    }
                }
            }
        }).then(package => ({package})) // wrap it up

    } else {
        // otherwise create a private instance
        return repl.qexec(`storage redis init --user ${constants.composerPackage}` + (options && options.provider ? ` --provider ${options.provider}` : ''))
    }
}*/

/**
 * Populate the composer-conductor package
 *
 */
/*const populatePackage = options => {
    return acquireRedis(options)
        .then( ({package}) => uri(package.parameters.find(({key})=>key==='_secrets').value.creds, options))
        .then(redis => { // this contains the redis secrets
            //
            // create the enclosing package, with the redis secrets as a bound parameter
            //
            const notify = true, // internal conductor feld
                  type = options && options.url ? 'url' : 'private',
                  $config = { redis, notify, type }

            return repl.qexec(`wsk package update ${constants.composerPackage}`, undefined, undefined, {
                parameters: { $config }
            })
                .then(composerPackage => {
                    // create the conductor action
                    return repl.qexec(`let ${composerPackage.name}/conductor = "${path.join(__dirname, '..', 'node_modules', '@ibm-functions/composer', 'conductor.js')}" -t 300000`)
                        .then(() => waitTillUp(redis, options, composerPackage))
                })
        })
}*/

/**
 * Ignore any caches, and populate the openwhisk and redis bits
 *
 */
/*const populateFromScratch = (wsk, options) => {
    return repl.qexec(`wsk package get ${constants.composerPackage}`)
        .catch(err => {
            if (err.statusCode !== 404) {
                // anything other than "not found" is a problem
                throw err
            } else {
                return { parameters: [{key: '$config', value: { type: 'none'} }] }
            }
        })
        .then(package => package.parameters.find(({key}) => key === '$config').value)
        .then($config => {
            if ($config.type === 'private') {
                return repl.qexec(`storage redis destroy --user ${constants.composerPackage}` + (options && options.provider ? ` --provider ${options.provider}` : ''))
            }
        })
        .then(() => populatePackage(options).then(cacheIt(wsk)))
}*/

/**
 * Turn a key->value map into a '--key1 value1 --key2 value2' cli opt string
 *
 */
const mapToOptions = (baseMap, overrides) => {
    const map = Object.assign({}, baseMap, overrides)
    return Object.keys(map).reduce((opts,key) => `${opts} --${key} ${map[key]}`, '')
}

/**
 * Initialize the composer-conductor for this namespace
 *
 * @return { package, manager }
 *
 */
const unsupported = () => { throw new Error('This operation is no longer supported') }
exports.init = (wsk, options) => {
    const manager = {
        flush: unsupported,
        kill: unsupported,
        purge: unsupported,

        // for now, we have to hack around the lack of a server-side conductor+topmost filter :(
        list: options => repl.qexec(`wsk activation list ${mapToOptions(options, { limit: 200 })}`)
            .then(activations => activations.filter(_ => {
                return _.annotations
                    && _.annotations.find(({key, value}) => key === 'conductor' && value)
                    && _.annotations.find(({key, value}) => key === 'topmost' && value)
            }))
            .then(activations => {
                const { skip=0, limit=activations.length } = options
                return activations.slice(skip, limit)
            })
    }
    manager.get = sessionId => repl.qexec(`wsk activation get ${sessionId}`).then(activation => {
        activation.prettyType = 'sessions'
        return activation
    })
    manager.trace = sessionId => manager.get(sessionId)
        .then(activation => activation.logs)
        .then(trace => ({trace})) // a list of activationIds

    return Promise.resolve({ manager })

    // has the user asked to switch redis instances?
    /*const resetRequested = options && options.reset

    if (!resetRequested && initDone) {
        // found in cache!
        return Promise.resolve({
            package: initDone,
            manager
        })

    } else {
        const cachedInLocalStorage = false//localStorage.getItem(lsKey)
        if (!resetRequested && cachedInLocalStorage) {
            return repl.qexec(`wsk package get ${constants.composerPackage}`) // double check that the package exists
                .then(() => Promise.resolve(cacheIt(wsk)({package: JSON.parse(cachedInLocalStorage)})))
                .catch(err => populatePackage(options).then(cacheIt(wsk)));
        } else if (resetRequested) {
            return populateFromScratch(wsk, options)
        } else{
            return repl.qexec(`wsk package get ${constants.composerPackage}`)
                .then(package => ({package})).then(cacheIt(wsk))
                .catch(err => {
                    if (err.statusCode === 404) {
                        return populateFromScratch(wsk, options)
                    } else {
                        throw err
                    }
                })
        }
    }*/
}

/**
 * Is the given struct a valid FSM?
 *   TODO, this is a primitive form of validation, for now
 *
 */
exports.isValidFSM = maybe => {
    return maybe
        && ( (maybe.constructor && maybe.constructor.name === 'Composition') // for nodejs
             || maybe.type                             // for other languages (for now, at least)
           )
}


/**
 * Return the store credentials
 *
 */
/*exports.properties = () => repl.qfexec(`wsk package get ${constants.composerPackage}`)
    .catch(err => {
        if (err.statusCode === 404) {
            const msg = document.createElement('dom'),
                  clicky = document.createElement('span'),
                  cmd = 'app init'

            msg.appendChild(document.createTextNode('Backing store not yet initialized. Consider using '))

            clicky.className = 'clickable clickable-blatant'
            clicky.innerText = cmd
            clicky.onclick = () => repl.pexec(cmd)
            msg.appendChild(clicky)
            msg.appendChild(document.createTextNode('.'))
            
            throw msg
        } else {
            throw err
        }
    })*/

/**
 * Extract the FSM source from the given entity
 *
 */
exports.getFSM = entity => {
    const fsmAnnotation = exports.fsmAnnotation(entity)

    if (fsmAnnotation) {
        return openwhiskComposer.util.deserialize(fsmAnnotation.value)
    }
}

/**
 * If the given entity has an associated FSM, return it, otherwise
 * return the entity
 *
 */
exports.maybeFSM = entity => exports.getFSM(entity) || `/${entity.namespace}/${entity.name}`

/**
 * Fetch the given named entity, and its corresponding FSM-compatible representation
 *
 */
exports.fetch = (wsk, name) => wsk.ow.actions.get(wsk.owOpts({ name })).then(entity => ({ entity, fsm: exports.maybeFSM(entity) }))

/**
 * Move a given entity out of the way
 *
 */
//exports.moveAside = entity => repl.qexec(`mv "/${entity.namespace}/${entity.name}" "/${entity.namespace}/${entity.name}-orig"`)
exports.moveAside = (wsk, name) => repl.qexec(`mv "${name}" "${name}-orig"`)
    .then(entity => ({ entity, fsm: exports.maybeFSM(entity) }))

/**
 * Create an invokeable entity for the given fsm
 *    re: the $name, conductor offers the feature of naming sessions, we don't currently use it
 */
/*const createBinding = ({wsk, appName, fsm}) => {
    return exports.init(wsk, { noping: true })
        .then(({package:composerPackage}) => {
            const bindName = `${composerPackage.name}.${appName}`
            return repl.qexec(`wsk package bind "${composerPackage.name}" "${bindName}"`,
                              undefined, undefined,
                              { parameters: { $invoke: fsm }
                              })
        })
}*/

/**
 * Delete an app-specific binding
 *
 */
/*exports.deleteBinding = name => repl.qexec(`wsk package delete ${constants.composerPackage}.${name}`)
    .catch(err => {
        console.error(err)
        return { error: name }
    }).then(() => ({ ok: name }))*/

/**
 * Merge previous and current and internal annotations. Take all of
 * the new (A2) annotations and add in any old (A1) annotations that
 * are not replaced by new ones.
 *
 */
const mergeAnnotations = (A1=[], A2=[], type, fsm) => {
    // map from annotation key to "is new"
    const inA2 = A2.reduce((M, {key}) => {
        M[key] = true
        return M
    }, {})

    // any old annotations are are not replaced by new ones
    const filteredA1 = A1.filter(({key}) => !inA2[key])

    // the union of old and new
    const annotations = A2.concat(filteredA1)

    if (type && fsm) {
        const fsmAnnotation = annotations.find(({key}) => key === 'fsm') || annotations.find(({key}) => key === 'conductor'),
              badgesAnnotation = annotations.find(({key}) => key === 'wskng.combinators'),
              badge = {"type":"composition","role":"replacement","badge":type}

        if (!fsmAnnotation) {
            annotations.push({ key: 'fsm', value: fsm })
        } else {
            fsmAnnotation.value = fsm
        }

        if (!badgesAnnotation) {
            annotations.push({ key: 'wskng.combinators', value: [badge] })
        } else {
            const existing = badgesAnnotation.value.find(({type}) => type === 'composition')
            if (existing) {
                existing.badge = type
            } else {
                badgesAnnotation.push(badge)
            }
        }
    }

    return annotations
}

/**
 * Create an invokeable entity for the given fsm
 *
 */
exports.create = ({name, fsm, type, extension:lang, annotations=[], parameters=[], wsk, commandTree, execOptions, cmd='update'}) => {
    debug('create', name, lang, fsm, annotations)
    const slash = name.indexOf('/'),
          packageName = slash > 0 && name.substring(0, slash),
          packageNameWithSlash = packageName ? `${packageName}/` : '', // for the action create
          appName = name.substring(slash + 1),
          fqnAppName = `${packageNameWithSlash}${appName}`,
          EMPTY = Promise.resolve({ parameters: [], annotations: [] })

    // create the binding, then create the action wrapper to give the app a name;
    // for updates, we also need to fetch the action, so we can merge the annotations and parameters
    return Promise.all([cmd === 'create' ? EMPTY : repl.qexec(`wsk action get "${fqnAppName}"`).catch(err => {
                            if (err.statusCode === 404) return EMPTY
                            else throw err
                        }),
                        !packageName ? Promise.resolve() : repl.qexec(`package update "${packageName}"`)
                       ])
        .then(([currentAction]) => {
            // now we merge together the parameters and annotations
            //let encodeElement = openwhiskComposer.encode(openwhiskComposer.composition(fqnAppName, fsm), "0.4.0")
            return repl.qexec(`app lang ${lang} encode impl ${fqnAppName}`, undefined, undefined, { parameters: { composition: fsm } })
                .then(actions => {
                    // multiple actions might be returned, as people can now use composer combinators to deploy new actions
                    // currently, the main composition action is always the last action in the array
                    debug('encode success', actions)

                    // legacy support for pre-v6 [NMM 20180616]
                    if (actions.actions) actions = actions.actions

                    const fsmAction = actions[actions.length ? actions.length - 1 : 0].action
                    fsmAction.parameters = currentAction.parameters.concat(parameters).concat(fsmAction.parameters || []),
                    fsmAction.annotations = mergeAnnotations(currentAction.annotations,
                                                             mergeAnnotations(annotations||[], fsmAction.annotations||[]),
                                                             type, fsm)
                    return fsmAction
                })
        })
        .then(fsmAction => wsk.owOpts({ // add common flags to the request
            name: fqnAppName,
            action: fsmAction
        }))
        .then(opts => wsk.ow.actions[cmd](opts)) // now we invoke the operation
        .then(entity => ui.headless ? Object.assign(entity, { verb: 'update', type: 'app' }) : repl.qfexec(`app get "/${entity.namespace}/${entity.name}"`))
        .catch(err => {
            throw err
        })
}

/**
 * Create an invokeable entity for the given fsm, and replace a given entity
*
*/
exports.update = ({name, entity, fsm, type, wsk, commandTree, execOptions, extension}) => {
    return exports.create({ name: name || entity.name,
                            extension,
                            annotations: entity.annotations,
                            parameters: entity.parameters,
                            fsm, type, wsk, commandTree, execOptions })
}

/**
 * Does the given action represent a composer app?
 *
 */
exports.isAnApp = action => {
    const anno = action && action.annotations && action.annotations.find(({key}) => key === 'conductor')
    return anno && anno.value
}

/**
 * Return the annotation that stores the IR/fsm
 *
 */
exports.fsmAnnotation = action => {
    const anno = action.annotations.find(({key}) => key === 'fsm')
          || action.annotations.find(({key}) => key === 'conductor')

    // avoid conductor:true as indicating the presence of an FSM
    return anno && anno.value !== true ? anno : undefined
}

/**
 * Does the given action have an IR/fsm associated with it?
 *
 */
exports.hasFSM = action => !!exports.fsmAnnotation(action)

/**
 * Helper method for kill and purge operations, which share enough code...
 *
 */
const killOrPurge = ({wsk, cmd, successMessage, failureMessage}) => sessionId => exports.init(wsk).then(({manager}) => {
    return cmd(manager, sessionId).then(response => successMessage)
})

/**
 * Kill a given session
 *
 */
exports.kill = wsk => killOrPurge({ wsk,
                                    cmd: (manager, sessionId) => manager.kill(sessionId),
                                    successMessage: 'Successfully terminated the given session',
                                    failureMessage: 'Error terminating the given session'
                                  })

/**
 * Purge session state
 *
 */
exports.purge = wsk => killOrPurge({ wsk,
                                     cmd: (manager, sessionId) => manager.purge(sessionId),
                                     successMessage: 'Successfully purged the given session',
                                     failureMessage: 'Error purging the given session'
                                   })

/**
 * Is the given sessionId a valid form?
 *
 */
const sessionPattern = /[a-fA-F0-9]{32}(:.*)?/
exports.isValidSessionId = sessionId => sessionId && (typeof sessionId === 'string') && sessionId.match(sessionPattern)

/**
 * Named sessions are sessionId:nameOfApp
 *
 * Suggested usage: 
 *    const { activationId, name } = splitNamedSession(sessionId)
 *
 */
const sessionColonNamePattern = /^([^:]+):(.*)$/    // named sessions are sessionId:nameOfApp
exports.splitNamedSession = sessionId => {
    const split = sessionId.split(sessionColonNamePattern)
    if (split && split.length >= 3) {
        return {
            activationId: split[1],
            name: split[2]
        }
    } else {
        return {
            activationId: sessionId,
            name: 'conductor' // fallback
        }
    }
}

/**
 * Error reporting
 *
 */
exports.handleError = (err, reject) => {
    console.error(err)
    if (reject) {
        reject(err)
    } else if (typeof err === 'string') {
        throw new Error(err)
    } else {
        throw err
    }
}

/**
 * Render the wskflow visualization for the given fsm.
 *
 * `container` is optional; wskflow will render in the default way in
 * the sidecar if we don't pass a container in
 *
 * @return { view, controller } where controller is the API exported by graph2doms
 */
exports.wskflow = (visualize, viewName, { fsm, input, name, packageName, viewOptions, container }) => {
    const { view, controller } = visualize(fsm, container, undefined, undefined, undefined, viewOptions);

    if (!viewOptions || !viewOptions.noHeader) {
        const onclick = undefined
        ui.addNameToSidecarHeader(undefined, name, packageName, onclick, viewName,
                                  'This is a preview of your app, it is not yet deployed')
    }
    
    return { view, controller }
}

/**
 * Zoom to fit buttons
 *
 */
exports.zoomToFitButtons = controller => {
    if (controller && controller.register) {
        const events = require('events'),
              zoom1to1Bus = new events.EventEmitter(),
              zoomToFitBus = new events.EventEmitter()

        const listener = event => {
            zoom1to1Bus.emit('change', event.applyAutoScale === false && !event.customZoom)
            zoomToFitBus.emit('change', event.applyAutoScale === true && !event.customZoom)
        }

        controller.register(listener)

        return [
            { label: '1:1', actAsButton: true, flush: 'right', balloon: 'Use a fixed-size canvas', selected: false,
              selectionController: zoom1to1Bus,
              visibleWhen: 'visualization',
              direct: () => {
                  controller.zoom1to1()
              }
            },
            { fontawesome: 'fas fa-expand', actAsButton: true, flush: 'right', balloon: 'Use a zoom to fit canvas', selected: true,
              selectionController: zoomToFitBus,
              visibleWhen: 'visualization',
              direct: () => {
                  controller.zoomToFit()
              }
            }
        ]

    } else {
        // probably some error initializing wskflow; try to safeguard against that
        return []
    }
}

/**
 * Turn an options struct into a cli string
 *
 * @param options is the command line options struct given by the
 * user.
 *
 */
const optionsToString = options => {
    let str = ''
    for (let key in options) {
        // underscore comes from minimist
        if (key !== '_' && options[key] !== undefined && key !== 'name' && key !== 'theme') {
            const dash = key.length === 1 ? '-' : '--',
                  prefix = options[key] === false ? 'no-' : '', // e.g. --no-help
                  value = options[key] === true || options[key] === false ? '' : ` ${options[key]}`

            if (! (dash === '-' && options[key] === false)) {
                // avoid -no-q, i.e. single dash
                str = `${str} ${dash}${prefix}${key}${value}`
            }
        }
    }

    return str
}
exports.optionsToString = optionsToString
/**
 * Entity view modes
 *
 */
exports.vizAndfsmViewModes = (visualize, commandPrefix, defaultMode='visualization', options) => [
    { mode: 'visualization', defaultMode: defaultMode==='visualization', direct: entity => {
        return repl.qexec(`${commandPrefix} "${entity.input}" ${optionsToString(options)}`)
    } },
    { mode: 'fsm', label: 'JSON', defaultMode: defaultMode==='fsm', direct: entity => {
        entity.type = 'actions'
        ui.showEntity(entity, { show: 'fsm' })
    } }
]

/**
 * Entity view mode if we have javascript source
 *
 */
exports.codeViewMode = {
    mode: 'source', label: 'code', direct: entity => {
        entity.type = 'actions'
        return ui.showEntity(entity, { show: 'source' })
    }
}

/**
 * Check for unknown options
 *
 */
exports.hasUnknownOptions = (options, expected) => {
    const M = expected.reduce((M, key) => { M[key] = true; return M; } , {})
    for (let opt in options) {
        // underscore comes from minimist
        if (opt !== '_' && !M[opt]) {
            throw new Error(`Unexpected option ${opt}`)
        }
    }
}

/**
 * Amend the result of an `action get`, to make the entity appear more
 * like an app
 *
 */
exports.decorateAsApp = ({action, viewName='app', commandPrefix='app get', doVisualize, options}) => {
    action.prettyType = appBadge
    action.fsm = exports.fsmAnnotation(action).value

    if (action.exec) {
        action.exec.prettyKind = 'app'
    }

    if (doVisualize) {
        // pass through cli options for the wskflow renderer
        const viewOptions = { }
        if (options.functions) {
            // note we must be careful not to pass false; only undefined
            viewOptions.renderFunctionsInView = options.functions // render all inline functions directly in the view?
        }

        const visualize = require(path.join(__dirname, '../../wskflow/lib/visualize'))
        const { view, controller } = exports.wskflow(visualize, viewName, Object.assign({}, action, { viewOptions }))

        action.modes = (action.modes||[]).filter(_ => _.mode !== 'code')
            .concat(exports.vizAndfsmViewModes(visualize, commandPrefix, undefined, options))
            .concat(exports.zoomToFitButtons(controller))

        return view || action

    } else {
        return action
    }
}

/**
 * Extract the Action Tasks from a given FSM
 *
 */
exports.extractActionsFromFSM = (composition) => {
    const actions = []

    /** recursively add actions from the given root sequence */
    const iter = root => {
        if(root.type === 'action'){
            actions.push(root.name);
        }
        else{
            Object.keys(root).forEach(key => {        
                if(Array.isArray(root[key])){
                    root[key].forEach(obj => iter(obj));                    
                }
                else if(typeof root[key] === 'object' && root[key] !== null){
                    iter(root[key])
                }
            })
        }        
    }

    // start from the root    
    iter(composition)
    return actions
}

/**
 * Deploy a given action, if we can find the source
 *
 */
const nsPattern = /^\/[^\/]\//
const stripNamespace = action => action.replace(nsPattern, '')
exports.deployAction = home => actionFQN => new Promise((resolve, reject) => {
    try {
        const actionName = stripNamespace(actionFQN),
              suffixes = ['.js', '.php', '.python']

        for (let idx = 0; idx < suffixes.length; idx++) {
            const suffix = suffixes[idx],
                  actionPath = path.join(home, `${actionName}${suffix}`),
                  filepath = ui.findFile(actionPath)

            debug('attempting to deploy action', actionPath)

            fs.exists(filepath, exists => {
                if (exists) {
                    debug('deploying action', actionName, filepath)
                    return repl.qexec(`wsk action update "${actionFQN}" "${filepath}"`)
                        .then(resolve, reject)
                }
            })
        }

        reject(`action source near ${path.join(home, actionName)} cannot be found`)

    } catch (err) {
        reject(err)
    }
}).catch(err => {
    console.error(err)
})
exports.deployActions = (home, actions) => {
    debug('deploying actions', home, actions)
    return Promise.all(actions.map(exports.deployAction(home)))
}

debug('init done')
