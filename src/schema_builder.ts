import * as admin from "firebase-admin";
import {EntityCollectionView} from "@camberi/firecms";
import {unslugify} from "./util";
import pluralize from "pluralize";

type DataType =
    | "number"
    | "string"
    | "boolean"
    | "map"
    | "array"
    | "timestamp"
    | "geopoint"
    | "reference"
    | "null";

type TypesCount = {
    number?: number,
    string?: number,
    boolean?: number,
    map?: MapTypesCountRecord,
    array?: TypesCount,
    timestamp?: number,
    geopoint?: number,
    reference?: number
};

type MapTypesCountRecord<K extends keyof DataType = any> = {
    [P in K]: TypesCount
};

/**
 *
 * @param type
 * @param typesCount
 * @param fieldValue
 */
function increaseCount(type: DataType, typesCount: TypesCount, fieldValue: any, firestoreApiFormat: boolean) {
    if (type === "map") {
        if (fieldValue) {
            let mapTypesCount = typesCount[type];
            if (!mapTypesCount) {
                mapTypesCount = {};
                typesCount[type] = mapTypesCount;
            }

            const mapValue: object = firestoreApiFormat ? fieldValue.mapValue.fields : fieldValue;
            Object.entries(mapValue).forEach(([key, value]) => {
                increaseRecordCount(mapTypesCount as MapTypesCountRecord, key, value, firestoreApiFormat);
            });
        }
    } else if (type === "array") {
        let arrayTypesCount = typesCount[type];
        if (!arrayTypesCount) {
            arrayTypesCount = {};
            typesCount[type] = arrayTypesCount;
        }

        const arrayValues: any[] = firestoreApiFormat ? fieldValue.arrayValue.values : fieldValue;
        if (arrayValues)
            arrayValues.forEach(value => {
                const arrayType = getType(value, firestoreApiFormat);
                increaseCount(arrayType, arrayTypesCount as TypesCount, value, firestoreApiFormat);
            });

    } else {
        if (!typesCount[type]) typesCount[type] = 1;
        else (typesCount[type] as number)++;
    }
}

function increaseRecordCount(typesCountRecord: MapTypesCountRecord, key: string, fieldValue: any, firestoreApiFormat: boolean) {
    let typesCount = typesCountRecord[key];
    if (!typesCount) {
        typesCount = {};
        typesCountRecord[key] = typesCount;
    }

    const type = getType(fieldValue, firestoreApiFormat);
    increaseCount(type, typesCount, fieldValue, firestoreApiFormat);
}

function getHighestTypesCount(typesCount: TypesCount): number {
    let highestCount = 0;
    Object.entries(typesCount).forEach(([type, count]) => {
        let countValue = 0;
        if (type === "map") {
            countValue = getHighestRecordCount(count as MapTypesCountRecord);
        } else if (type === "array") {
            countValue = getHighestTypesCount(count as TypesCount);
        } else {
            countValue = count as number;
        }
        if (countValue > highestCount) {
            highestCount = countValue;
        }
    });

    return highestCount;
}

function getHighestRecordCount(record: MapTypesCountRecord): number {
    return Object.entries(record)
        .map(([key, typesCount]) => getHighestTypesCount(typesCount))
        .reduce((a, b) => Math.max(a, b));
}

function getMostProbableType(typesCount: TypesCount): DataType {
    let highestCount = 0;
    let probableType: DataType = "string"; //default
    Object.entries(typesCount).map(([type, count]) => {
        let countValue = 0;
        if (type === "map") {
            countValue = getHighestRecordCount(count as MapTypesCountRecord);
        } else if (type === "array") {
            countValue = getHighestTypesCount(count as TypesCount);
        } else {
            countValue = count as number;
        }
        if (countValue > highestCount) {
            highestCount = countValue;
            probableType = type as DataType;
        }
    });
    return probableType;
}

function buildSchemaFromTypesCount(mostProbableType: DataType, typesCount: TypesCount, firestoreApiFormat: boolean, key?: string) {
    const res: any = {dataType: mostProbableType};
    if (key)
        res.title = unslugify(key);

    if (mostProbableType === "map") {
        res.properties = buildSchemaFromRecord(typesCount.map as MapTypesCountRecord, firestoreApiFormat);
    } else if (mostProbableType === "array") {
        let arrayTypesCount = typesCount.array as TypesCount;
        let arrayMostProbableType = getMostProbableType(arrayTypesCount);
        res.of = buildSchemaFromTypesCount(arrayMostProbableType, arrayTypesCount, firestoreApiFormat);
    }
    return res;
}

function buildSchemaFromRecord(countRecord: MapTypesCountRecord, firestoreApiFormat: boolean) {
    const res = {};
    Object.entries(countRecord).forEach(([key, typesCount]) => {
        let mostProbableType = getMostProbableType(typesCount);
        res[key] = buildSchemaFromTypesCount(mostProbableType, typesCount, firestoreApiFormat, key);
    })
    return res;
}


export function buildSchemaForObjects(docsData: any[], firestoreApiFormat: boolean) {
    const typesCount: MapTypesCountRecord = {};
    docsData.forEach((entry) => {
        Object.entries(firestoreApiFormat ? entry.fields : entry).forEach(([key, value]) => {
            increaseRecordCount(typesCount, key, value, firestoreApiFormat);
        })
    });
    return buildSchemaFromRecord(typesCount, firestoreApiFormat);
}

export function buildCollectionViewFromFirestoreResults(docsData: any, collectionId: string): EntityCollectionView<any> {
    const name = unslugify(collectionId);
    const pluralName: string = pluralize(name);
    return {
        name: pluralName,
        relativePath: collectionId,
        schema: {
            name: name,
            properties: buildSchemaForObjects(docsData.documents, true)
        }
    };
}

function getType(value: any, firestoreApiFormat: boolean): DataType {
    if (firestoreApiFormat)
        return getFirestoreApiType(value);

    if (typeof value === "number")
        return "number";
    else if (typeof value === "string")
        return "string";
    else if (typeof value === "boolean")
        return "boolean";
    else if (Array.isArray(value))
        return "array";
    else if (value instanceof admin.firestore.Timestamp)
        return "timestamp";
    else if (value instanceof admin.firestore.GeoPoint)
        return "geopoint";
    else if (value instanceof admin.firestore.DocumentReference)
        return "reference";
    return "map";
}

function getFirestoreApiType(value: any): DataType {
    if (!!value.bytesValue || !!value.doubleValue || !!value.integerValue)
        return "number";
    else if (!!value.stringValue)
        return "string";
    else if (!!value.booleanValue)
        return "boolean";
    else if (!!value.arrayValue)
        return "array";
    else if (!!value.timestampValue)
        return "timestamp";
    else if (!!value.geoPointValue)
        return "geopoint";
    else if (!!value.referenceValue)
        return "reference";
    else if (!!value.mapValue)
        return "map";
    return "null";
}
