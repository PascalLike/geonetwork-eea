//=============================================================================
//===	Copyright (C) 2001-2013 Food and Agriculture Organization of the
//===	United Nations (FAO-UN), United Nations World Food Programme (WFP)
//===	and United Nations Environment Programme (UNEP)
//===
//===	This program is free software; you can redistribute it and/or modify
//===	it under the terms of the GNU General Public License as published by
//===	the Free Software Foundation; either version 2 of the License, or (at
//===	your option) any later version.
//===
//===	This program is distributed in the hope that it will be useful, but
//===	WITHOUT ANY WARRANTY; without even the implied warranty of
//===	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
//===	General Public License for more details.
//===
//===	You should have received a copy of the GNU General Public License
//===	along with this program; if not, write to the Free Software
//===	Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA
//===
//===	Contact: Jeroen Ticheler - FAO - Viale delle Terme di Caracalla 2,
//===	Rome - Italy. email: geonetwork@osgeo.org
//==============================================================================

package org.fao.geonet.kernel.harvest.harvester.geoPREST;

import jeeves.server.context.ServiceContext;

import org.fao.geonet.Logger;
import org.fao.geonet.domain.Source;
import org.fao.geonet.exceptions.BadInputEx;
import org.fao.geonet.kernel.harvest.harvester.AbstractHarvester;
import org.fao.geonet.kernel.harvest.harvester.AbstractParams;
import org.fao.geonet.kernel.harvest.harvester.HarvestResult;
import org.fao.geonet.repository.SourceRepository;
import org.fao.geonet.resources.Resources;
import org.jdom.Element;

import java.io.File;
import java.sql.SQLException;
import java.util.UUID;

//=============================================================================

public class GeoPRESTHarvester extends AbstractHarvester<HarvestResult> {

    //--------------------------------------------------------------------------
    //---
    //--- Init
    //---
    //--------------------------------------------------------------------------

    private GeoPRESTParams params;

    //---------------------------------------------------------------------------
    //---
    //--- Add
    //---
    //---------------------------------------------------------------------------

    protected void doInit(Element node, ServiceContext context) throws BadInputEx {
        params = new GeoPRESTParams(dataMan);
        super.setParams(params);
        params.create(node);
    }

    //---------------------------------------------------------------------------
    //---
    //--- Update
    //---
    //---------------------------------------------------------------------------

    protected String doAdd(Element node) throws BadInputEx, SQLException {
        params = new GeoPRESTParams(dataMan);
        super.setParams(params);

        //--- retrieve/initialize information
        params.create(node);

        //--- force the creation of a new uuid
        params.setUuid(UUID.randomUUID().toString());

        String id = harvesterSettingsManager.add("harvesting", "node", getType());

        storeNode(params, "id:" + id);
        Source source = new Source(params.getUuid(), params.getName(), params.getTranslations(), true);
        context.getBean(SourceRepository.class).save(source);
        Resources.copyLogo(context, "images" + File.separator + "harvesting" + File.separator + params.icon, params.getUuid());

        return id;
    }

    //---------------------------------------------------------------------------

    protected void doUpdate(String id, Element node) throws BadInputEx, SQLException {
        GeoPRESTParams copy = params.copy();

        //--- update variables
        copy.update(node);

        String path = "harvesting/id:" + id;

        harvesterSettingsManager.removeChildren(path);

        //--- update database
        storeNode(copy, path);

        //--- we update a copy first because if there is an exception GeoPRESTParams
        //--- could be half updated and so it could be in an inconsistent state

        Source source = new Source(copy.getUuid(), copy.getName(), copy.getTranslations(), true);
        context.getBean(SourceRepository.class).save(source);
        Resources.copyLogo(context, "images" + File.separator + "harvesting" + File.separator + copy.icon, copy.getUuid());

        params = copy;
        super.setParams(params);

    }

    //---------------------------------------------------------------------------
    //---
    //--- Harvest
    //---
    //---------------------------------------------------------------------------

    protected void storeNodeExtra(AbstractParams p, String path,
                                  String siteId, String optionsId) throws SQLException {
        GeoPRESTParams params = (GeoPRESTParams) p;

        harvesterSettingsManager.add("id:" + siteId, "baseUrl", params.baseUrl);
        harvesterSettingsManager.add("id:" + siteId, "icon", params.icon);

        //--- store search nodes

        for (Search s : params.getSearches()) {
            String searchID = harvesterSettingsManager.add(path, "search", "");

            harvesterSettingsManager.add("id:" + searchID, "freeText", s.freeText);
        }
    }

    //---------------------------------------------------------------------------
    //---
    //--- Variables
    //---
    //---------------------------------------------------------------------------

    public void doHarvest(Logger log) throws Exception {
        Harvester h = new Harvester(cancelMonitor, log, context, params);
        result = h.harvest(log);
    }
}
