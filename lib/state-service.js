'use strict';

const SyncService = require('./sync-service');
const mapper = require('./mapper.js');

class StateSyncService extends SyncService{
    constructor(adapter, firestore, database, uid){
        super(adapter, firestore, database, uid, 'state');

        this.database = database;
        this.dbStateQueuesRef = {};
        this.objectList = {};
        this.stateTypes = {};

        this._initMe();
        this.upload();
    }

    _initMe(){
        this.dbStateQueuesRef = this.database.ref('stateQueues/' + this.uid);
        this.dbStateQueuesRef.on('child_added',(data) => {
            this.adapter.log.info('state update received: ' + JSON.stringify(data.val()));
            let id = data.val().id;
            let val = data.val().val;
            this._setState(id, val);
            this.dbStateQueuesRef.child(data.ref.key).remove();
        });
    }

    onObjectChange(id, obj){
        if(this.objectList[id] === true){
            if(obj === null){
                super.deleteObject(id);
            }else{
                let object = mapper.getStateObject(id, obj);
                super.syncObject(id, object);
            }
        }

        if(obj === null || id === null){
            return;
        }
        
        if(obj.type === "enum" && (id.indexOf('enum.rooms.') === 0 || id.indexOf('enum.functions.') === 0)){
            this.objectList = {};
            this.stateTypes = {};
            this.upload();
        }
    }

    onStateChange(id, state){
        if(this.objectList[id] === true){
            let tmp = mapper.getState(id, state);   
            let node = super._getNode(id); 
            
            if((this.stateValues[id] === null || this.stateValues[id] !== tmp.val) || state.from.indexOf('system.adapter.iogo') !== -1){
                this.stateValues[id] = tmp.val;
                this.database.ref('states/' + this.uid + '/' + node).set(tmp, (error) => {
                    if (error) {
                        this.adapter.log.error(error);
                    } else {
                        this.adapter.log.debug('state ' + id + ' saved successfully');
                    }
                });
            }
        }
    }

    upload(){

        this.adapter.log.info('uploading state');

        this.adapter.getForeignObjects('*', 'enum', (err, objects) => {
            
            for (let id in objects) {
                if(id.indexOf('enum.rooms.') === 0 || id.indexOf('enum.functions.') === 0){
                    let object = objects[id];
                    for (let key in object.common.members) {
                        this.objectList[object.common.members[key]] = true;
                    }
                }
            }

            this.adapter.getForeignObjects('*', 'state', (err, objects) => {
            
                let tmpList = [];
                for (let id in objects) {
                    if(this.objectList[id] === true){
                        this.stateTypes[id] = objects[id].common.type;
                        //let parentChannelId = id.slice(id.lastIndexOf("."));
                        let parentDevicelId = id.split(".").slice(0,-2).join(".");
                        let deviceObject = getObject(parentDevicelId);
                        let tmpState = mapper.getStateObject(id, objects[id]);
                        tmpState.deviceName = deviceObject.common.name;
                        tmpList[id] = tmpState;
                    }
                }
    
                super.syncObjectList(tmpList);

                this.adapter.getForeignStates('*', (err, states) => {
        
                    let stateList = [];
                    for (let id in states) {
                        if(this.objectList[id] === true){
                            let node = super._getNode(id);
                            if(states[id] != null){
                                let tmp = mapper.getState(id, states[id]);
                                
                                if(typeof states[id].val !== this.stateTypes[id]){
                                    this.adapter.log.warn('Value of state ' + id + ' has wrong type');
                                }
                                this.stateValues[id] = tmp.val;
                                stateList[node] = tmp;
                            }
                        }
                    }
            
                    super.syncStateList(stateList);
                });
            });

        });
    
    }

    destroy(){
        if(this.dbStateQueuesRef != undefined){
            this.dbStateQueuesRef.off();
        }
    }

    _setState(id, val){
        let newVal = val;
        if(this.stateTypes[id] == "number"){
            newVal = parseFloat(val);
        }else if(this.stateTypes[id] == "boolean"){
            newVal = (val == "true");
        }
        if(id.indexOf('iogo.') === 1){
            this.adapter.setState(id, newVal);
        }else{
            this.adapter.setForeignState(id, newVal);
        }
    }

}

module.exports = StateSyncService;