import { getIn } from "formik";
import {
    FormControl,
    FormHelperText,
    Input,
    InputLabel
} from "@material-ui/core";
import React, { ReactElement } from "react";
import { CMSFieldProps, FieldDescription } from "@camberi/firecms";

interface CustomLargeTextFieldProps extends CMSFieldProps<string> {
    rows: number
}

export default function CustomLargeTextField({
                                                 property,
                                                 field,
                                                 rows,
                                                 form: { isSubmitting, errors, touched, setFieldValue },
                                                 ...props
                                             }: CustomLargeTextFieldProps)
    : ReactElement {

    const fieldError = getIn(errors, field.name);
    const showError = getIn(touched, field.name) && !!fieldError;

    const value = field.value;

    return (
        <FormControl
            required={property.validation?.required}
            error={showError}
            disabled={isSubmitting}
            fullWidth>
            <InputLabel>{property.title || field.name}</InputLabel>
            <Input
                multiline
                rows={rows}
                defaultValue={value}
                onChange={(evt:any) => setFieldValue(
                    field.name,
                    evt.target.value
                )}
            />

            {showError && <FormHelperText
                id="component-error-text">{fieldError}</FormHelperText>}

            <FieldDescription property={property}/>

        </FormControl>
    );

}
