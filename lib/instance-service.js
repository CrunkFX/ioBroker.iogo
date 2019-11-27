'use strict';

const SyncService = require('./sync-service');
const mapper = require('./mapper.js');

class InstanceSyncService extends SyncService{
    constructor(adapter, firestore, database, uid){
        super(adapter, firestore, database, uid, 'instance');

        this.objectList = {};

        this.upload();
    }

    onObjectChange(id, obj){
        if(obj === null){
            if(this.objectList[id] === true){
                delete this.objectList[id];
                super.deleteObject(id);
            }
        }else{
            this.objectList[id] = true;
            let object = mapper.getInstanceObject(id, obj);
            super.syncObject(id, object);
        }
    }

    onStateChange(id, state){
        if(id.indexOf('system.adapter.') === 0){
            let node = this._getNode(this._getInstanceFromId(id));
            super.syncState(id, node, state);
        }
    }

    upload(){

        this.adapter.log.info('uploading instance');
    
        this.adapter.getForeignObjects('*', 'instance', (err, objects) => {
            
            let tmpList = [];
            for (let id in objects) {
                this.objectList[id] = true;
                tmpList[id] = mapper.getInstanceObject(id, objects[id]);
            }

            super.syncObjectList(tmpList);
        });

        this.adapter.getForeignStates('system.adapter.*', (err, states) => {
            
            let stateList = [];
            for (let id in states) {
                let node = this._getNode(this._getInstanceFromId(id));
                if(states[id] != null && id.lastIndexOf('upload') === -1){
                    if(stateList[node] === undefined){
                        stateList[node] = {};
                    }
                    if(stateList[node]['id'] === undefined){
                        stateList[node]['id'] = 'system.host.' + this._getInstanceFromId(id);
                    }
                    let attr = id.substr(id.lastIndexOf(".")+1);
                    let val = super.getStateVal(id, attr, states[id].val);
                    if(val !== null){
                        stateList[node][attr] = val;
                    }
                }
            }

            super.syncStateList(stateList);
        });
    }

    _getInstanceFromId(id){
        let tmp = id.substr(15);
        tmp = tmp.substr(0, tmp.lastIndexOf('.'));
        return tmp;
    }
    
}

module.exports = InstanceSyncService;