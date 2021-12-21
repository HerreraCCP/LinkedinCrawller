const isEmpty = (obj) => {
  return Object.keys(obj).length === 0;
};

const FindFieldToValue = (FieldFind, Obj) => {
  Obj = JSON.parse(JSON.stringify(Obj));
  const ValueObj = Object.keys(Obj);
  for (let iObj = 0; iObj < ValueObj.length; iObj++) {
    const Field = ValueObj[iObj];
    if (Field.toLowerCase() == FieldFind.toLowerCase()) {
      return Obj[Field];
    }
  }
};

const parse = (model, value) => {
  return parseFields(model, value);
};

const parseFieldToInt = (value) => {
  let dataValue = value;
  if (dataValue == undefined) return 0;
  if (typeof dataValue == 'boolean') {
    dataValue = dataValue == true ? 1 : 0;
  } else if (typeof dataValue == 'string') {
    if (dataValue.toString().length == 0) return 0;
    dataValue = dataValue.replace(/[^0-9]/g, '');
    dataValue = parseInt(dataValue);
  }

  return dataValue;
};

const assign = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

const typesFields = {
  cpf: 'cpf',
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  object: 'object',
};

const parseFields = (Modelo, Value) => {
  /* 
      exemplos de parse
      const modelo = {
        name: { type: "string", optional: true, default: "Elio Lima" },
      }
    */

  if (!Value) return {};
  let errors = {};
  if (!Array.isArray(Value)) {
    let ObjValue = JSON.parse(JSON.stringify(Value));
    let NewModelo = assign(Modelo);
    let NewValue = {};
    const fieldRequired = Object.keys(NewModelo).filter(
      (f) => !!NewModelo[f] && !!NewModelo[f].type && !NewModelo[f].optional
    );

    Object.keys(NewModelo).forEach((v1) => {
      const fieldModel = {
        name: v1,
        ...NewModelo[v1],
      };

      if (
        typeof NewModelo[v1] === typesFields.object &&
        Object.keys(typesFields).includes(fieldModel.type)
      ) {
        Object.keys(ObjValue).forEach((v2) => {
          let type = typeof ObjValue[v2];
          const value = ObjValue[v2];
          let length = 0;

          if (fieldModel.type === typesFields.string)
            length = ObjValue[v2].toString().length;

          if (fieldModel.type === typesFields.cpf) {
            type = typesFields.cpf;
            length = ObjValue[v2].toString().length;
          }

          if (fieldModel.type === typesFields.object)
            length = Object.keys(ObjValue[v2]).length;

          if (fieldModel.type === typesFields.number) length = parseInt(value);

          if (
            fieldModel.type === typesFields.boolean &&
            fieldModel.optional === true
          )
            length = 1;
          else if (
            fieldModel.type === typesFields.boolean &&
            !fieldModel.optional &&
            value === true
          )
            length = 0;

          let fieldValue = {
            name: v2,
            value,
            type,
            length,
          };
          try {
            if (
              fieldModel?.name.toLowerCase() === fieldValue?.name.toLowerCase()
            ) {
              if (fieldModel.type !== fieldValue.type) {
                if (fieldModel.convert == true) {
                  if (
                    fieldModel.type === typesFields.string &&
                    fieldValue.type === typesFields.number
                  ) {
                    fieldValue.type = typesFields.string;
                    fieldValue.value = fieldValue.value.toString();
                  }
                }
              }

              if (fieldModel.type !== fieldValue.type) {
                errors[
                  fieldValue.name
                ] = `${fieldValue.name} é obrigatório, deve ser do tipo ${fieldValue.type}.`;
              } else if (fieldValue.length === 0 && !fieldValue.optional) {
                errors[
                  fieldValue.name
                ] = `${fieldValue.name} é obrigatório e não foi informado.`;
              } else if (
                fieldValue.length === 0 &&
                fieldValue.optional === true &&
                !!fieldValue.default
              ) {
                NewValue[v1] = fieldValue.default;
              } else {
                if (fieldModel.type === typesFields.object) {
                  const resultParseFields = parseFields(
                    fieldModel.value || fieldValue.value,
                    fieldValue.value
                  );

                  if (resultParseFields.err == true) {
                    errors = {
                      ...errors,
                      [fieldValue.name]: resultParseFields,
                    };
                  } else {
                    NewValue[v1] = resultParseFields;
                  }
                } else {
                  if (fieldValue.type == typesFields.cpf) {
                    let cpf = fieldValue.value.toString();
                    NewValue[v1] = `${cpf.padStart(11, '0')}`;
                  } else {
                    NewValue[v1] = fieldValue.value;
                  }
                }
              }
            }
          } catch (error) {
            console.log('error', { fieldValue, fieldModel }, error);
            errors[fieldModel.name] = `${fieldModel.name} error inesperado.`;
          }
        });

        if (!NewValue[v1] && !!NewModelo[v1].default) {
          NewValue[v1] = NewModelo[v1].default;
        } else if (!NewValue[v1] && !NewModelo[v1].default) {
          delete NewValue[v1];
        }
      } else {
        Object.keys(fieldModel).forEach((field) => {
          try {
            const name = Object.keys(ObjValue).find(
              (f) => f.toLowerCase() === fieldModel[field].toLowerCase()
            );
            if (name) {
              NewValue[v1] = ObjValue[name];
            }
          } catch (error) {
            console.log('error', { field, ObjValue, fieldModel });
          }
        });
      }
    });

    fieldRequired.forEach((f) => {
      if (!NewValue[f] && !errors[f]) {
        errors[
          f
        ] = `${f} é obrigatório, deve ser do tipo ${NewModelo[f].type}.`;
      }
    });

    if (Object.keys(errors).length > 0)
      return {
        err: true,
        messages: errors,
      };

    return NewValue;
  }

  if (Value.length === 0) return;

  let Modelos = [];
  for (let iValue = 0; iValue < Value.length; iValue++) {
    const element = Value[iValue];
    let NewModeloTemp = assign(Modelo);
    let bAdd = false;

    Object.keys(NewModeloTemp).forEach((v) => {
      if (FindFieldToValue(v, element)) {
        NewModeloTemp[v] = FindFieldToValue(v, element);
        if (!bAdd) bAdd = true;
      }
    });

    if (bAdd) {
      Modelos.push(NewModeloTemp);
    }
  }

  return Modelos;
};

const checkObject = (obj, key) =>
  Object.keys(obj).find((f) => f == key) ? true : false;

module.exports = {
  parse,
  isEmpty,
  parseFieldToInt,
  FindFieldToValue,
  checkObject,
};
