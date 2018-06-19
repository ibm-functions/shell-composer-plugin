/*
 * Copyright 2017-18 IBM Corporation
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

const debug = require('debug')('app create')
debug('loading')

const { create, isValidFSM, hasUnknownOptions, extractActionsFromFSM, deployActions } = require('./composer'),
      badges = require('./badges'),
      messages = require('./messages.json'),
      fs = require('fs'),
      path = require('path'),
      { create:usage } = require('./usage'),
      { readFSMFromDisk, compileToFSM } = require('./create-from-source')

debug('finished loading modules')

/**
  * compileToFSM returns a struct as its error
  *
  */
const handleFailure_fsmPromise = err => {
    if (err.fsm) {
        const error = new Error(err.fsm)
        for (let key in err) {
            error[key] = err[key]
        }
        throw error
    } else {
        throw err
    }
}

/**
 * Here is the app create module entry point. Here we register command
 * handlers.
 *
 */
module.exports = (commandTree, prequire) => {
    const wsk = prequire('/ui/commands/openwhisk-core')

    const doCreate = cmd => function(_1, _2, fullArgs, { ui, errors }, fullCommand, execOptions, args, options) {
        const idx = args.indexOf(cmd) + 1,
              dryRun = options['dry-run'] || options.n,  // compile to check for errors, but don't create anything
              recursive = options.recursive || options.r // try to deploy tasks, too

        let name = args[idx],                            // name of creation
            input = dryRun ? name : args[idx + 1]        // input file; if dryRun, then it's the first and only non-opt arg

        // check for unknown options
        /*hasUnknownOptions(options, [ 'n', 'dry-run', 'all',
                                     'h', 'help',
                                     'r', 'recursive',
                                     'a', 'annotation',
                                     'p', 'parameter', 'P', 'param-file',
                                     'm', 'memory', 'l', 'logsize', 't', 'timeout',                                     
                                     'log-all', 'log-input', 'log-inline' ])*/

        // if the user didn't provide an input file, maybe we can
        // infer one from the current selection
        if (!input) {
            const selection = ui.currentSelection()
            if (selection && selection.fsm) {
                debug('input from selection')
                // then the sidecar is currently showing an app
                if (selection.prettyType === 'preview') {
                    // then the sidecar is showing an app preview
                    const inputAnnotation = selection.annotations.find(({key}) => key === 'file')
                    if (inputAnnotation) {
                        input = inputAnnotation.value
                        debug('using preview for input', input)

                        if (!name) {
                            // then the user typed "app create"; let's use the file name as the app name
                            name = selection.name.replace(/\.[^\.]*/,'') // strip off the ".js" suffix
                            debug('using preview for name', name)
                        }
                    }
                }
            }
        }
        
        if (!name || !input) {
            debug('insufficient inputs')
            throw new errors.usage(usage(cmd), undefined, 497)
            
        } else {
            let fsmPromise // our goal is to acquire an FSM, so that we can create an invokable OpenWhisk wrapper for it
            let type       // metadata to help with understanding how this FSM was created; 

            const extension = input.substring(input.lastIndexOf('.') + 1)

            if (extension === 'json' || extension === 'fsm') {
                //
                // we were given the FSM directly
                //
                debug('input is composer FSM')
                const fsm = readFSMFromDisk(args[idx + 1])

                if (!isValidFSM(fsm)) {
                    // some basic validation of the fsm
                    throw new Error(messages.invalidFSM)
                } else {
                    type = badges.fsm
                    fsmPromise = Promise.resolve({fsm})
                }

            } else if (extension === 'js' || extension === 'py') {
                //
                // we were given the source code, which means we'll need to generate the FSM
                //
                debug('input is composer library client', extension)
                type = badges.composerLib
                fsmPromise = compileToFSM(input, extension, { code: true }) // we want the code back

                if (dryRun) {
                    return fsmPromise
                        .then(() => 'Your code compiles without error')
                        .catch(handleFailure_fsmPromise)
                }

            } else {
                throw new errors.usage({ message: messages.unknownInput,
                                         usage: usage(cmd) },
                                       undefined, 497)
            }

            const { kvOptions: { action: { annotations=[], parameters=[] }={} }={} } = wsk.parseOptions(fullArgs, 'action');

            /*if(options['log-input'] || options['log-inline'] || options['log-all']){
                debug('adding input logging');                
                //let index = annotations.findIndex(element => element.key == 'log'), logType;
                let logType;
                if((options['log-input'] && options['log-inline']) || options['log-all'])
                    logType = 'all';
                else if(options['log-input'])
                    logType = 'input';
                else
                    logType = 'inline';
                
                //if(index == -1) annotations.push({key: 'log', value: logType});
                //else annotations[index] = {key: 'log', value: logType};
                annotations.push({key: 'log', value: logType})

                return fsmPromise.then(({fsm,code,localCodePath}) => {
                    if (code) {
                        annotations.push({key: 'code', value: code})
                    }
                    if (localCodePath) {
                        annotations.push({key: 'file', value: localCodePath})
                    }

                    let count = 0;
                    let addEcho = name => {
                        let echoName = 'echo_'+count;
                        count++;
                        fsm.States[echoName] = {
                            Next: name,
                            type: 'action',
                            name: '/whisk.system/utils/echo',
                            Helper: 'echo'
                        } 
                        return echoName;
                    }

                    if(logType == 'all' || logType == 'inline'){
                        Object.keys(fsm.States).forEach(name => {
                            if(name.indexOf('choice') == 0){
                                [fsm.States[fsm.States[name].Then], fsm.States[fsm.States[name].Else]].forEach(s => {
                                    if(s.Function && s.Helper == undefined){
                                        s.Next = addEcho(s.Next);
                                    }
                                });                            
                            }                        
                            else if(fsm.States[name].Next){
                                let nextState = fsm.States[fsm.States[name].Next];                        
                                if(nextState.Function && nextState.Helper == undefined){
                                    nextState.Next = addEcho(nextState.Next);
                                }

                                if(name.indexOf('try') == 0 && fsm.States[fsm.States[name].Handler].Function && fsm.States[fsm.States[name].Handler].Helper == undefined){
                                    fsm.States[fsm.States[name].Handler].Next = addEcho(fsm.States[fsm.States[name].Handler].Next);
                                }
                            }
                            
                        });
                    }

                    if(logType == 'all' || logType == 'input')
                        fsm.Entry = addEcho(fsm.Entry);

                    return create({ name, fsm, wsk, commandTree, execOptions, type, cmd, annotations });
                }).catch(handleFailure_fsmPromise)

            }
            else*/ {
                /*let index = annotations.findIndex(element => element.key === 'log');
                if(index !== -1) annotations.splice(index, 1);
                else annotations.push({key: 'log', value: false});*/
                //console.log('app create no logging', index, annotations);
                // great, we now have a valid FSM!                    
                return fsmPromise.then(({fsm,code,localCodePath}) => {
                    if (code) {
                        annotations.push({key: 'code', value: code})
                    }
                    if (localCodePath) {
                        annotations.push({key: 'file', value: localCodePath})
                    }

                    // were we asked to (try to) deploy the actions referenced by the FSM?
                    const deployStep = !localCodePath || !recursive
                          ? Promise.resolve()
                          : deployActions(path.dirname(localCodePath),
                                          extractActionsFromFSM(fsm))

                    return deployStep.then(() => create({ name, fsm, extension, wsk, commandTree, execOptions, type, cmd, annotations, parameters }))
                }).catch(handleFailure_fsmPromise)
            }
        }
    }

    // Install the routes
    const cmd = commandTree.listen(`/wsk/app/create`, doCreate('create'), { usage: usage('create') })
    commandTree.synonym(`/wsk/app/update`, doCreate('update'), cmd, { usage: usage('update') })
}

debug('finished loading')
